# PlayDate

**A family-centric platform for parents to help their children make friends and arrange
safe playdates with other families.**

The fundamental unit is a **verified family account**, never an individual child.
Children are dependents on a family record — they have no login, no inbox, and no way to
be contacted.

> ### Prototype status
> This is a **frontend prototype with a mock data layer**. Identity verification, SMS and
> email are **simulated**. Nothing here has been security-audited or legally reviewed.
> Read [`docs/PROTOTYPE_DISCLOSURES.md`](docs/PROTOTYPE_DISCLOSURES.md) before drawing any
> conclusions about what works.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

On the landing page or the sign-in page, choose **“Explore the prototype”** to sign in as
the seeded Cohen family — it opens with 11 matching families, two pending requests, two
live conversations, a confirmed playdate and an open moderation case, so every flow is
immediately demonstrable.

```bash
npm test           # domain tests: matching engine + privacy redaction
npm run build      # typecheck + production build
```

---

## The idea in one diagram

```
Verified parent → family profile → controlled discovery → mutual consent → parent-to-parent contact
```

Every arrow is a gate. There is no path through this diagram that lets an unverified
adult reach information about someone else's child, and no path at all that reaches a
child directly.

---

## What to look at first

| If you want to see… | Open |
| --- | --- |
| The matching model | [`src/domain/matching/`](src/domain/matching/) — a scorer registry, squared importance weighting, hard constraints, reasons attached to every result |
| The privacy model | [`src/domain/privacy/redaction.ts`](src/domain/privacy/redaction.ts) — the single choke point where a family becomes visible to another family |
| Why those two are trustworthy | [`engine.test.ts`](src/domain/matching/engine.test.ts) and [`redaction.test.ts`](src/domain/privacy/redaction.test.ts) — 38 tests, including assertions that private fields *cannot* appear in a projection |
| The API contract a backend would implement | [`src/services/api.ts`](src/services/api.ts) |
| Authorization and rate limiting | [`src/services/security/`](src/services/security/) |
| The reasoning behind all of it | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |

---

## Four decisions worth explaining

### 1. Privacy is a type, not a permission check

The usual failure mode is sending the whole record to the client and hiding fields in the
UI. That leaks through the network tab, through a mis-ordered conditional, through the
next developer who adds a debug panel.

Instead, `projectFamily()` builds a **`FamilyProjection`** — a different type with no
field for an address, phone number, legal name, date of birth, school or coordinates.
Cross-family reads return only this type.

A permission check can be forgotten. A missing field cannot be rendered.

### 2. Importance is squared, so critical interests actually dominate

```
interestScore = Σ(importance² · affinity) / Σ(importance²)
```

With linear weights, five 1-star interests outweigh one 5-star interest. Squared, a
"critical" interest is worth 25× a "not important" one — so the thing a parent genuinely
cares about cannot be outvoted by a pile of trivia. The denominator normalises, so
marking everything critical gains nothing; only the *relative* ordering of your own stars
matters. This is asserted in the tests.

### 3. Hard constraints exclude, they do not rank

Outside the travel radius, outside the age range, no overlapping availability, blocked —
these remove a family from the pool entirely rather than sorting them last. Parents are
never shown families they could not actually meet. A separate "why were these filtered
out?" view keeps that legible.

### 4. Never a bare percentage

`MatchResult` cannot be constructed without reasons. The UI shows a **band** — "Strong
potential match" — plus the sentences behind it:

> ✓ Children are the same age
> ✓ 5 shared interests
> ✓ LEGO & building matters to both families
> ✓ Families are approximately 1–2 km apart
> ✓ Availability overlaps on Friday afternoons, Saturday afternoons

A "92%" invites a parent to trust an arithmetic artefact over their own reading of a
family. The number exists in the object for ranking and future evaluation; it is never
the headline.

---

## Project layout

```
src/
  domain/          Pure TypeScript — no React, no I/O, unit-tested
    types.ts         The data model; children are structurally not principals
    interests.ts     Controlled interest catalogue (not free text — see below)
    matching/        Scorer registry, engine, tests
    privacy/         projectFamily() — the disclosure choke point — and tests
    trust/           Trust signals as facts, never a score
    safety/          Message-pattern prompts, safety copy
    validation.ts    Shared validators (client-side = UX, must be re-run server-side)
  services/
    api.ts           The contract a real backend implements
    security/        Authorization guards, rate limiting
    mock/            localStorage-backed implementation of the contract
  state/           Session + own-family only; never caches another family's data
  components/      UI primitives, layout, family/discovery/safety components
  pages/           public · app · admin
  styles/          Design tokens, components, layout
docs/
  ARCHITECTURE.md          Product architecture, flows, data model, security, matching
  SECURITY.md              Threat model and the production security requirements
  PROTOTYPE_DISCLOSURES.md What is real, what is simulated, what was never assessed
```

Nothing above `services/index.ts` imports from `mock/`. Swapping in an HTTP backend is
one new class and one changed line.

---

## Language rules

The product must never make a parent feel like they are shopping for children.

| Not this | This |
| --- | --- |
| "Find kids near you" | "Discover families your children may connect with" |
| "Match your child" | "Find compatible families" |
| "127 children in your area" | "12 families match your preferences" |

Interests come from a **fixed catalogue** rather than free text — partly for matching
quality, mainly so the interest field cannot become a back door for sorting families by
religion, ethnicity or any other sensitive characteristic. The matcher reads ages,
interests, importance weights, distance, availability and playdate style. That is the
complete list.

---

## MVP scope

**Built:** family accounts · parent auth and sessions · verification workflow (simulated,
labelled) · children · interests with importance weights · granular privacy controls with
live previews · discovery · weighted explainable matching · connection requests · mutual
acceptance · parent-to-parent messaging with safety tooling · playdate planning with a
safety checklist · reporting · blocking · moderation queue · audit log · responsive UI.

**Architected for, not built:** a real identity provider · SMS and email providers · push
notifications · maps and public-venue recommendations · ML-assisted moderation · fraud and
duplicate-account detection · reputation mechanisms · calendar integration · native apps ·
fine-grained multi-parent permissions · per-region compliance configuration.

---

## The test every feature has to pass

> *Would a reasonable parent feel comfortable putting their family's information into
> this?*

If the answer is no, the feature gets redesigned.
