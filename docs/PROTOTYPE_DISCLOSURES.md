# What is real and what is simulated

This repository is a **frontend prototype**. It is genuinely usable — you can complete
every flow end to end — but a working interaction is not the same as a working service.

This page exists because the brief was explicit on one point: *do not pretend that mock
verification is real verification.* The same honesty applies to everything else here.

---

## Simulated — do not rely on any of it

| Thing | What actually happens |
| --- | --- |
| **Identity verification** | Nothing is verified. No provider is connected, no document is read, no face is matched. You click "Simulate: verified" and a field changes. A "Parent verified" badge in this build means **nothing** about any real person. |
| **Email delivery** | No email is sent. The 6-digit code is printed on screen because there is nowhere for it to go. |
| **SMS delivery** | No SMS is sent. Same as above. |
| **Two-factor authentication** | A toggle that records intent. No second factor is ever requested or checked. |
| **Password hashing** | None. There is no server, so there is nothing to hash with. A placeholder string is stored. |
| **Moderation** | Decisions are written to browser storage. No reviewer sees anything. No account anywhere is affected. |
| **Reports** | Go nowhere. No safety team exists. |
| **Rate limiting** | Real token-bucket logic, but it runs in the browser — so it is trivially bypassed. Client-side limits stop honest accidents, never an attacker. |
| **Notifications** | Generated locally. No push, no email. |
| **Distances** | Computed from fictional coordinates in `src/data/seed.ts`. |
| **Every family, parent, child, message and playdate** | Fictional. Invented for this prototype. |

---

## Real — the parts worth reviewing

These are implemented properly and are what the prototype is actually for:

- **The matching engine** (`src/domain/matching/`) — a modular scorer registry with
  squared importance weighting, hard constraints that exclude rather than rank, and
  reasons attached to every result. Unit-tested.
- **The privacy projection** (`src/domain/privacy/redaction.ts`) — the single choke point
  that turns a `Family` into a `FamilyProjection`. Unit-tested, including assertions that
  private fields cannot appear in the output.
- **The disclosure-tier model** — consent genuinely gates what the UI receives, not just
  what it renders.
- **Authorization checks** (`src/services/security/guards.ts`) — enforced in the service
  layer rather than in routing.
- **Audit logging with PII redaction** — every sensitive action, every payload stripped.
- **The API boundary** (`src/services/api.ts`) — a real contract that an HTTP backend can
  implement without touching a single component.
- **The interaction design** — every flow in the brief works: onboarding, discovery,
  matching, requests, acceptance, messaging, playdate planning, reporting, blocking,
  moderation.
- **English and Hebrew localisation** (`src/i18n/`) — the whole interface, both
  directions. The Hebrew dictionary is typed against the English one, so an untranslated
  key fails the build rather than reaching a parent's screen. RTL is real layout
  mirroring via CSS logical properties, not a flipped stylesheet.

---

## Known gaps between this and something deployable

1. **Sessions live in `localStorage`.** Production needs `HttpOnly; Secure; SameSite`
   cookies that JavaScript cannot read. This is the largest single gap.
2. **All authorization is client-side.** Every check in `guards.ts` must be re-implemented
   server-side. Client checks are UX, not security.
3. **All data is in the browser.** `localStorage` is readable by anything on the origin.
   Acceptable for fictional data; never acceptable for real family data.
4. **The CSP is a `<meta>` tag.** It must be a response header, with nonces instead of
   `'unsafe-inline'` for styles, plus `frame-ancestors`, HSTS, `X-Content-Type-Options`
   and `Referrer-Policy`.
5. **No file uploads.** Child photos are modelled but not implemented. When they are, EXIF
   stripping is mandatory — an un-stripped photo carries GPS coordinates and would defeat
   the entire location-privacy design.
6. **No account recovery flow.** Historically the most exploited path in any product like
   this.
7. **No tests above the domain layer.** The matching and redaction logic is tested;
   components and flows were verified by driving a real browser, not by an automated
   regression suite.
8. **The Hebrew copy has not been reviewed by a native-speaker editor.** The mechanism is
   sound and the coverage is complete, but the register and phrasing of ~1,350 strings is
   a translation-review task, not an engineering one. Hebrew second person is written in
   the plural (אתם) throughout to avoid guessing a parent's gender; a professional pass
   should confirm that choice reads well in every context.

---

## Not assessed at all

- **Security.** No audit, no penetration test, no threat-model review by anyone but its
  author.
- **Legal compliance.** No DPIA, no jurisdiction analysis, no counsel involved. GDPR, the
  UK Age Appropriate Design Code, COPPA and local equivalents all impose real obligations
  on a service like this, and none of them have been assessed. See
  [`SECURITY.md` §9](./SECURITY.md#9-compliance--a-production-requirement-not-completed-work).
- **Accessibility.** Built with semantic markup, labelled controls, visible focus, a
  focus-trapped dialog, live regions and reduced-motion support — but never tested with a
  screen reader or by anyone who uses one.
- **Child safeguarding policy and operations.** No trained moderators, no escalation route
  to law enforcement, no safeguarding lead. For a real service these are not optional and
  are not a software problem.

---

If you are demonstrating this, the honest framing is: *"this is what the product would
feel like, and this is the architecture that makes the safety claims enforceable — none of
the external integrations are real yet."*
