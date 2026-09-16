# PlayDate — Security model

> **This prototype has not been security-audited, penetration-tested, or legally
> reviewed.** This document describes the model the code is *shaped around*, and states
> plainly where the prototype falls short of it. See
> [`PROTOTYPE_DISCLOSURES.md`](./PROTOTYPE_DISCLOSURES.md).

---

## 1. Threat model

A platform about children attracts a specific set of adversaries. Designing against
"hackers" in the abstract produces nothing useful; these are the ones that shaped the
code.

| Adversary | What they want | Primary controls |
| --- | --- | --- |
| **Predatory adult** | Reach a child, or gather enough information to find one offline | Identity verification as a gate; no child principals; no contact without mutual consent; no address/school/exact location at any tier; coarse availability; grooming-pattern prompts; reporting |
| **Scraper / enumerator** | Bulk-collect family and child data | Discovery rate limits; projections that omit private fields; no public profiles; no ids in URLs that enumerate; audit of discovery volume |
| **Impersonator** | Pose as a parent, or as a specific parent | Email + phone + government-ID verification; per-family "verified only" toggle; duplicate-account detection (future) |
| **Harasser / stalker** | Repeatedly contact someone who declined | One-shot request notes; connection-request rate limits; silent decline; immediate bilateral block; report thresholds |
| **Abusive ex-partner** | Locate a family that left | Location bands not coordinates; discoverability off-switch; block removes both directions; no read receipts on requests |
| **Malicious insider (our own staff)** | Browse family data out of curiosity or worse | Four roles, least privilege; elevated reads require an open case id; every elevated read audited with that case; verification agents cannot read conversations |
| **Compromised parent account** | Use a legitimate account as a foothold | MFA; session idle expiry; device list with revocation; re-auth on privilege change (production); audit trail |
| **Child using a parent's device** | Reach the platform as an adult | Nothing here is a substitute for device-level controls, but: no child-attractive surfaces, no child-to-child anything, and MFA on sensitive actions |

Explicit non-goal: PlayDate is **not an emergency service**, and the UI says so wherever
it could be mistaken for one.

---

## 2. Authentication

| Control | Production requirement | Prototype |
| --- | --- | --- |
| Password storage | Argon2id (or scrypt), server-side, per-user salt, tuned work factor | A placeholder string. **No hashing occurs** — there is no server |
| Password policy | Minimum length over complexity rules; breached-password check via k-anonymity range API; no forced rotation | Length + strength meter + common-password rejection (`domain/validation.ts`) |
| MFA | TOTP and WebAuthn; SMS only as a fallback (SIM-swap risk) | A toggle that records intent; no second factor is enforced |
| Sign-in failures | One generic message for every failure mode | Implemented — `mockApi.signIn` returns the same error for unknown account and wrong password |
| Rate limiting | Per-account and per-IP, progressive backoff, CAPTCHA escalation | Per-account token bucket (`services/security/rateLimit.ts`) |
| Account recovery | The most commonly exploited path. Requires re-verification for a verified account; never a security-question flow | Not implemented |

**Account enumeration.** Sign-in returns one message for every failure. Sign-*up* is
deliberately explicit that an email is taken, because a generic error there strands a
legitimate user with no path forward; the tradeoff is documented rather than accidental,
and production should pair it with a rate limit and an email-based confirmation flow.

---

## 3. Session management

**Production:**
- Session token in an `HttpOnly; Secure; SameSite=Lax` cookie — unreadable by JavaScript,
  so an XSS bug cannot exfiltrate it.
- Idle timeout (30 min) and absolute lifetime (e.g. 12 h).
- Rotate the session id on sign-in and on any privilege change.
- Server-side session store so revocation is immediate, not "wait for the JWT to expire".
- Device/session list with per-device revocation; a new-device sign-in notifies the
  account owner by email.

**Prototype:** the session lives in `localStorage` with an idle expiry
(`services/mock/store.ts`). This is the single largest gap between this code and
something deployable, and it exists only because a static prototype has no server to set
a cookie. It is called out in `PROTOTYPE_DISCLOSURES.md`.

---

## 4. Authorization

Four roles, deliberately narrow:

| Role | May see | May not see |
| --- | --- | --- |
| `parent` | Their own family in full; other families only through `projectFamily` at the tier consent has reached | Anything private about another family, at any tier |
| `verification_agent` | Identity verification submissions and decisions | Conversations, children's details, discovery activity |
| `moderator` | Reported content **within an open case**, and account states | A family's full message history; identity data outside a case |
| `admin` | Configuration, role assignment, audit log | — (but every access is audited) |

Enforcement lives in `services/security/guards.ts` and is called from the **service
layer**, not from routing. React route guards in `App.tsx` are a UX affordance only: they
stop a parent landing on a confusing page. A hand-crafted navigation cannot reach data,
because the data never leaves the service layer un-projected.

`assertCanDiscover` is the load-bearing check: an account that is not email-verified,
phone-verified, ID-verified and in good standing cannot browse families, cannot send
requests, and cannot open a compatibility view.

---

## 5. Data protection

### 5.1 The projection boundary

The most important control in this codebase is not a permission check — it is a type.

`projectFamily()` (`domain/privacy/redaction.ts`) constructs a `FamilyProjection`, which
has **no field** for an address, phone number, email, legal name, date of birth, school,
or coordinates. Cross-family reads return this type and only this type.

A permission check can be forgotten. A missing field cannot be rendered. The test suite
asserts the absence directly — `redaction.test.ts` serialises a projection and fails if
any coordinate, email or phone pattern appears in it.

### 5.2 Location

Precise coordinates are stored once, because distance maths needs them. They are never
returned. Distance is exposed as a **band** ("2–4 km"), never a figure: an exact distance
from a known point is a circle, and three circles are a position. Bands defeat that
trilateration.

### 5.3 Encryption

- **In transit:** TLS 1.2+ only, HSTS with `includeSubDomains` and preload.
- **At rest:** full-disk/volume encryption as a baseline, plus **field-level** encryption
  for the `ParentIdentity` table (legal name, DOB, provider reference) with keys in a KMS
  and a separate key per environment. Field-level encryption means a database backup leak
  does not hand over identity data.
- **ID documents:** never stored by us. They go to the verification provider; we keep a
  decision and an opaque reference.

### 5.4 Retention and minimisation

- Children are stored with an **age in years, not a date of birth** — there is no
  birthday to leak and no precise identifier.
- Interests come from a fixed catalogue, not free text.
- Declined requests, closed conversations and resolved cases should have defined
  retention windows (not implemented in the prototype).
- Deleting a family must hard-delete children's records, not soft-delete them.

---

## 6. Application security

| Risk | Position |
| --- | --- |
| **XSS** | React escapes by default. This codebase contains **zero** uses of `dangerouslySetInnerHTML` — that is the control, and it should be enforced by a lint rule in CI. A strict CSP with nonces is the defence in depth; the `<meta>` CSP in `index.html` is a weaker stand-in and must become a response header in production (`frame-ancestors` and `report-uri` only work as headers). `style-src 'unsafe-inline'` is currently required by React's inline style attributes — the fix is hashed or nonced styles. |
| **CSRF** | Not applicable to the prototype (no cookies). Production: `SameSite=Lax` cookies plus a per-session token on every state-changing request. |
| **Injection** | No SQL in the prototype. Production: parameterised queries only; never string-built SQL; ORM-level allowlists on sortable/filterable fields. |
| **Input validation** | `domain/validation.ts` and `sanitiseText()` on every write path. Client-side validation is a UX affordance — **every rule must be re-applied server-side**. |
| **IDOR** | Every object read checks membership, not just existence. `getConversation` verifies the viewer is a participant; a conversation id is not a capability. |
| **File uploads** | Not implemented. Production: validate magic bytes not extensions, re-encode images to strip EXIF (which carries GPS), serve from a separate origin, virus-scan, never execute. Child photos in particular must have EXIF stripped — an un-stripped photo leaks the home address the rest of this design works to protect. |
| **Dependencies** | Small surface by design: React, React DOM, React Router. Production: lockfile integrity, automated advisories, SBOM. |
| **Secrets** | None in this repo. Production: a secret manager, no secrets in env files in images, rotation. |

---

## 7. Abuse prevention

Rate limits (`services/security/rateLimit.ts`), tuned to the shape of legitimate use:

| Action | Burst | Refill | Why |
| --- | --- | --- | --- |
| Sign-in | 5 | 1/min | Slows credential stuffing |
| Verification codes | 5 | 1/min | Slows code brute-force |
| **Connection requests** | **10** | **0.2/min** | The primary abuse vector. A real parent sends a handful a week; an abuser wants hundreds |
| Messages | 30 | 3/min | Slows flooding without hampering a real conversation |
| Discovery pages | 60 | 10/min | Caps enumeration of the community |
| Reports | 10 | 0.5/min | Slows report-brigading |

Other controls:

- **Report grouping** — several reports about one family become a single case, so a
  pattern across independent reporters is visible as a pattern. A third report raises
  priority automatically, but **never** changes an account state; only a human does.
- **Silent decline** — declining tells the other family nothing. Declining must never be
  socially costly, or people will stop doing it.
- **Blocking is bilateral and immediate** — no review, no reason, closes conversations,
  withdraws pending requests, and removes each family from the other's results.
- **Reported families are never notified.** Notification invites retaliation against the
  reporter and gives the subject time to delete evidence.
- **No public reputation.** Trust is a list of verifiable facts, never a score, and
  families are never ranked against each other.

**Deliberately not built:** behavioural profiling, cross-conversation risk scoring,
shadow "risk files" on families, device fingerprinting beyond a session list. The
principle is *collect the minimum, protect it strongly, expose as little as possible* —
surveillance of parents is not a safety feature.

---

## 8. Audit logging

Every sensitive action writes an `AuditLogEntry` (`services/mock/store.ts`). Two rules:

1. **Append-only.** Production: a separate store, separate retention, tamper-evident
   (hash chaining or a WORM bucket), and not writable by the application role that reads
   it.
2. **Privacy-aware.** Every payload passes through `redactForLog()` before being written.
   The audit trail records *what happened* — never message contents, names, contact
   details or coordinates. An audit log that becomes a second, less-protected copy of the
   family database is a liability, not a control.

Elevated staff reads carry the `caseId` that justified them. "Because I could" leaves a
trace that says exactly that.

---

## 9. Compliance — a production requirement, not completed work

**This prototype makes no claim of legal compliance.** Because the service concerns
children, the following are hard prerequisites before any real deployment:

- A **DPIA** (GDPR Art. 35) — processing children's data at scale requires one.
- **Jurisdiction analysis** per launch market. At minimum: GDPR and national child-data
  provisions (EU/UK), the **UK Age Appropriate Design Code**, **COPPA** (US),
  Israeli Privacy Protection Law, and any applicable local regulation.
- **Lawful basis and parental consent** models, which differ by country — the code's
  region-agnostic architecture is designed so consent and retention rules can be
  configured per region, but those rules are not written.
- **Data residency and transfer** mechanisms for cross-border processing.
- **Retention and deletion** schedules, including a real right-to-erasure implementation.
- **Vendor due diligence** on the identity provider, SMS provider and hosting.
- **A child-safeguarding policy**, trained human moderators, and an escalation route to
  law enforcement / NCMEC-equivalent bodies.
- **An independent security audit and penetration test.**
- **Accessibility** conformance testing (WCAG 2.2 AA). The prototype uses semantic
  markup, labelled controls, visible focus, a focus-trapped dialog, live regions for
  toasts and reduced-motion support, but has not been tested with real assistive
  technology.

None of the above has been done. Treat this repository as a design and interaction
prototype only.
