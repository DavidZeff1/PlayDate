# PlayDate — Architecture

> **Prototype status.** This repository is a **frontend prototype** with a mock
> persistence layer. Identity verification, SMS delivery, and moderation actions are
> **simulated**. Nothing here has been security-audited or legally reviewed. See
> [`PROTOTYPE_DISCLOSURES.md`](./PROTOTYPE_DISCLOSURES.md) for the explicit list of
> what is real and what is mocked, and [`SECURITY.md`](./SECURITY.md) for the
> production security model this prototype is shaped around.

---

## 1. Product architecture

### 1.1 The governing invariant

Everything in this codebase exists to protect one hierarchy:

```
Verified parent → family profile → controlled discovery → mutual consent → parent-to-parent communication
```

A child is a **dependent record owned by a family**, never a principal. There is no
child login, no child session, no child-addressable inbox, and no code path where an
identifier belonging to a child can be used as an actor. This is enforced structurally:
the `Session` type carries a `parentId`, and there is no `Child` branch in the auth
union. A child cannot be an actor because the type system has no way to express it.

### 1.2 Layers

```
┌─────────────────────────────────────────────────────────────┐
│  pages/ + components/         React. Rendering only.        │
│                               Cannot read raw Family objects │
│                               for anyone but the viewer.     │
├─────────────────────────────────────────────────────────────┤
│  state/                       Session + app store. Holds the │
│                               viewer identity and nothing    │
│                               another family owns.           │
├─────────────────────────────────────────────────────────────┤
│  services/                    Async "API". One interface,    │
│                               two implementations (mock now, │
│                               HTTP later). Every call is     │
│                               authorised, rate-limited and   │
│                               audit-logged here.             │
├─────────────────────────────────────────────────────────────┤
│  domain/                      Pure TypeScript. No React, no  │
│                               storage, no I/O. Matching,     │
│                               redaction, trust, safety.      │
│                               Unit-testable in isolation.    │
└─────────────────────────────────────────────────────────────┘
```

The rule that matters: **`domain/privacy/redaction.ts` is the only way a family record
becomes viewable by another family.** The service layer never returns a raw `Family` to
anyone but its own members. Pages receive `FamilyProjection` objects that physically do
not contain an address, a phone number, a legal name, or a date of birth — those fields
were dropped before the object crossed the layer boundary. A UI bug therefore cannot leak
them; the data is not in the object to leak.

### 1.3 Localisation is a layer rule, not a feature

`i18n/` sits beside `domain/` rather than above it, and enforces one rule on everything
below the UI: **no layer below `pages/` may produce a human sentence.**

The domain emits a key plus interpolation variables. `matchFamilies()` returns
`{ key: 'reason.sharedInterests', vars: { n: 5 } }`, not `"5 shared interests"`.
`projectFamily()` returns `{ kind: 'distance', bandKey: 'dist.2to4' }`, not
`"2–4 km away"`. Validation returns `{ key, vars }`. The API's suggested next steps
return `titleKey` / `descKey` / `ctaKey`.

This was forced by adding Hebrew, but it is the right shape regardless: a service that
returns prose is a service that can only ever serve one locale, and the sentences it
returns cannot be unit-tested without asserting on English copy.

Two type-level guarantees hold it together:

- `TKey` is derived from the English dictionary (`keyof typeof en`), so `t('nav.setings')`
  does not compile.
- `dict.he.ts` is declared `Record<TKey, string>`, so **an untranslated key is a build
  error.** There is no runtime fallback that silently renders `nav.settings` to a parent.

Direction is handled as layout, not translation. `dir` is set once on `<html>`; the
stylesheet uses CSS logical properties throughout, so the entire app mirrors without a
parallel RTL stylesheet. `styles/rtl.css` covers only what logical properties cannot
express — transforms (via a `--dir` multiplier), directional icons, Hebrew font stacks,
and the LTR islands (phone, email, opaque IDs, numeric inputs) that must not mirror
inside RTL text. Dates, numbers and list joins go through `Intl.DateTimeFormat`,
`Intl.NumberFormat` and `Intl.ListFormat`.

### 1.4 Why a projection instead of "hide it in the UI"

The common failure mode for products like this is sending the full record to the client
and hiding fields with CSS or conditionals. That leaks through the network tab, through
a mis-ordered conditional, through any future developer who adds a debug panel. Building
the redaction into a pure function that *constructs a different type* makes the safe path
the only path — `FamilyProjection` has no `homeAddress` field to render.

---

## 2. Main user flows

### 2.1 Onboarding (11 steps)

```
1  Create parent account      email · phone · strong password
2  Verify email + phone       6-digit codes (simulated delivery)
3  Identity verification      provider hand-off (mocked, clearly labelled)
4  Create family profile      display name · general area · about
5  Add children               first name/nickname · age · notes
6  Interests + importance     per interest: 1–5 importance weight
7  Location preferences       travel radius · area granularity
8  Availability               day × time-of-day grid
9  Privacy preferences        per-category disclosure levels
10 Safety guidelines          acknowledged, recorded with timestamp
11 Enter discovery
```

Discovery is gated: a family whose parent is not `verified` can complete a profile but
cannot browse other families or send requests. This is checked in the service layer
(`assertCanDiscover`), not only in routing, so a hand-crafted request cannot bypass it.

### 2.2 Discovery → connection → playdate

```
Discover            sees FamilyProjection at DISCOVERY tier only
   │                 (general area, child ages, interests, coarse availability)
   ▼
Compatibility       explainable match breakdown, still DISCOVERY tier
   │
   ▼
Send request        one pending request per family pair; rate-limited
   │
   ▼
Recipient decides   Accept · Decline · Maybe later · Report
   │
   ├─ decline/report → requester is told nothing beyond "no longer pending"
   │                   (declining must never be socially costly or informative)
   ▼
Accepted            connection created, disclosure rises to CONNECTED tier
   │                 → conversation opens, children's chosen names visible,
   │                   photos visible only if separately consented
   ▼
Plan a playdate     activity · public meeting place · date/time
   │
   ▼
Both confirm        PLANNING tier: agreed meeting point, attendance confirmations
```

At no point does either side receive a street address, phone number, email, school, or
legal name. Contact happens inside the platform.

### 2.3 Report → review → action

Reports never publicly alter a family's presentation. A report creates a moderation case;
only a moderator decision changes an account state. The states are
`active · verification_required · under_review · restricted · suspended · banned`.
Blocking is immediate and unilateral (it needs no review), and is mutual in effect: a
blocked family disappears from discovery in both directions.

---

## 3. Data model

```
Account ────< ParentProfile >──── FamilyMembership ────> Family
   │                                                       │
   │ authentication, MFA, sessions                         ├──< Child
   │ private identity (never projected)                    ├──  FamilyPreferences
   │                                                       ├──  Availability
                                                           ├──  PrivacySettings
                                                           └──  TrustSignals

Family ──< ConnectionRequest >── Family      (mutual consent gate)
Family ──< Connection >──────── Family       (created only on accept)
Connection ──< Conversation ──< Message
Connection ──< PlayDate ──< Attendance · SafetyChecklist
Report ──> ModerationCase ──> ModerationAction ──> AuditLogEntry
```

### 3.1 The privacy split (this is the important part)

Two record types, deliberately never merged:

| `ParentIdentity` — private, never projected | `Family` — social / discovery |
| --- | --- |
| legal name | family display name ("The Cohen Family") |
| date of birth | general area ("Jerusalem area") |
| phone number | number of children |
| email | children's ages |
| ID document reference | interests + importance |
| verification provider + session id | availability windows |
| precise home coordinates | playdate style preferences |

`ParentIdentity` is reachable only by (a) the parent themselves, and (b) a moderator
acting on an open case, and every such read writes an audit entry. It has no code path
into `FamilyProjection` — see `redaction.ts`, which builds projections from the social
record only.

Precise coordinates are stored once (needed for distance maths) and are **never
returned**. Distance is computed server-side and returned as a *band* — "2–4 km" — never
a coordinate pair or an exact figure that could be trilaterated by a family moving their
own pin.

### 3.2 Multi-parent, forward-compatible

`FamilyMembership` is a join table, not a foreign key on `Family`. A family already
supports multiple parents with roles (`primary` / `secondary`), and a parent could later
belong to more than one family (separated households sharing children) without a
migration. Role-based permissions per membership are stubbed for the MVP but the field
exists.

---

## 4. Security model

Full detail in [`SECURITY.md`](./SECURITY.md). The short version:

| Concern | Prototype | Production requirement |
| --- | --- | --- |
| Password storage | strength meter + validation only | Argon2id, server-side, never client |
| Session | in-memory token, idle expiry, device list | HttpOnly · Secure · SameSite=Lax cookies, rotation on privilege change |
| MFA | simulated TOTP/SMS step | real TOTP + WebAuthn; SMS as fallback only |
| Identity verification | mocked provider hand-off, clearly labelled | Persona / Stripe Identity / Veriff; ID images never touch our storage |
| Authorization | `guards.ts` checked in service layer | same checks server-side; client checks are UX only |
| Rate limiting | token bucket in mock API | edge + per-account limits, progressive backoff |
| XSS | React escaping; zero `dangerouslySetInnerHTML`; CSP meta | strict CSP with nonces, no inline script |
| CSRF | n/a (no cookies in prototype) | SameSite cookies + per-session token on mutations |
| Audit | append-only `AuditLogEntry` list | append-only store, separate retention, tamper-evident |
| PII in logs | `redactForLog()` used on every logged payload | structured logging with field-level allowlist |

**Least privilege in practice.** Four roles: `parent`, `moderator`, `verification_agent`,
`admin`. A verification agent can see an ID verification decision but not a family's
conversations. A moderator can see reported messages *in the reported thread only*, not a
family's whole history. Neither can read another family's children's details without an
open case. Every elevated read is audit-logged with case id and reason.

---

## 5. Matching model

### 5.1 Shape

```ts
matchFamilies(viewer: Family, candidate: Family, ctx: MatchContext): MatchResult
```

Pure function. No React, no network, no storage. It is called identically by the
discovery list, the compatibility modal, and the unit tests.

Internally it is a **registry of scorers**, not a hardcoded formula:

```ts
interface Scorer {
  id: string;
  label: string;
  score(viewer, candidate, ctx): ScorerOutput; // { value: 0..1, weight, reasons[], blocking? }
}
```

Shipped scorers: `age-compatibility`, `weighted-interests`, `distance`, `availability`,
`activity-style`, `group-size`. Adding a scorer is adding a file and one registry line.
Swapping the whole combination strategy (for a learned model trained on real outcomes)
means implementing one interface — the UI calls `matchFamilies` and renders
`result.reasons`, so it is unaffected.

### 5.2 Weighted interests — not a count

The core rule from the brief: *a shared interest the parent marked critical must
dominate a minor one.* The scorer computes, for each of the viewer's children against
each of the candidate's children:

```
interestScore = Σ(importanceᵢ² · affinityᵢ) / Σ(importanceᵢ²)
```

where `importance ∈ 1..5` is the **viewer's** declared weight and `affinity ∈ 0..1` is
how strongly the candidate child shares that interest (their own 1–5 rating, normalised).

Squaring importance is the deliberate choice. Linear weights make five 1-star matches
equal to one 5-star match; squared weights make a 5-star match worth 25× a 1-star one, so
a single critical shared interest cannot be outvoted by a pile of trivia. The denominator
normalises, so a parent who marks everything critical is not advantaged — only the
*relative* ordering of their own stars matters.

Unmatched interests are not punished. Two families who share LEGO strongly are a good
match even if one also does ballet.

### 5.3 Blocking constraints vs. soft scores

Some things are not "low scores", they are disqualifiers: outside the stated travel
radius, zero availability overlap, no child within any acceptable age range, or an
existing block. These return `blocking: true` and remove the candidate from the pool
entirely rather than ranking it last, so parents are never shown families they cannot
actually meet.

### 5.4 Explainability is a hard requirement

`MatchResult` cannot be constructed without reasons — every scorer returns
`reasons: MatchReason[]`, and the UI renders the reasons, not the number. The numeric
score maps to a **band** (`Strong potential match` / `Good potential match` /
`Possible match`) because a false-precision "92%" invites parents to trust an arithmetic
artefact over their own judgement. The number exists in the object for ranking and for
future evaluation against real outcomes; it is never the headline.

### 5.5 What is deliberately excluded

The matcher does not read, and must not read: religion, ethnicity, nationality, income,
politics, disability, or any proxy for them (school name, neighbourhood-as-demographic).
Only parent-declared, playdate-relevant preferences participate. Interests are drawn from
a **controlled vocabulary** (`INTEREST_CATALOG`) rather than free text, so the matching
surface cannot become a channel for sensitive-attribute sorting through creative tagging.

---

## 6. MVP scope vs. future

**Built here:** family accounts, parent auth + session, verification workflow (mocked),
children, interests with importance weights, granular privacy controls, discovery,
weighted explainable matching, connection requests, mutual acceptance, parent messaging
with safety tooling, playdate planning with safety checklist, reporting, blocking,
moderation queue, audit log, responsive UI, full English/Hebrew localisation with RTL
layout mirroring.

**Architected for, not built:** real identity provider, real SMS/email delivery, push
notifications, maps and public-venue recommendations, ML-assisted moderation, fraud and
duplicate-account detection, reputation mechanisms, calendar integration, native apps,
fine-grained multi-parent permissions, per-region compliance configuration, further
locales (the mechanism is in place; each new language is a dictionary plus a typography
review, and any RTL language reuses the existing mirroring).
