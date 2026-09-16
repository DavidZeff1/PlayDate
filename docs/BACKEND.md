# Backend — API tier, database and deployment

This document covers the server that sits between the browser and Postgres: how
to run it, what is implemented, and what is deliberately still missing.

For the product architecture see [`ARCHITECTURE.md`](ARCHITECTURE.md); for the
threat model, [`SECURITY.md`](SECURITY.md); for the honest inventory of what is
real, [`PROTOTYPE_DISCLOSURES.md`](PROTOTYPE_DISCLOSURES.md).

---

## The rule that shapes everything here

**The browser never talks to the database.**

This is not a style preference. The core of the privacy design is
`projectFamily()` — a column-level narrowing that depends on the viewer's
disclosure tier. Row-level security gates *rows*; it does not naturally express
"this viewer sees `neighborhood` but not `coordinates`, a first name but not a
surname, an age band but not a birthday."

In the prototype, `projectFamily()` ran client-side, which meant the full
`Family` record — coordinates included — had already crossed the wire before
anything narrowed it. `ARCHITECTURE.md` §1.4 claimed "the data is not in the
object to leak"; that was true of the rendered object and false of the response
body.

It is true now. `server/handlers/discovery.ts` projects before serialising, and
`loadFamiliesForDiscovery` never selects `precise_lat`, `precise_lng`,
`home_address`, legal names or dates of birth. What is not loaded cannot leak.

---

## Running it

```bash
cp .env.example .env.local     # then fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:migrate             # apply server/db/schema.sql
npm run db:seed                # optional; needs SEED_DEMO_DATA=true
npm run dev
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`VITE_API_URL` selects the backend. Unset, the app falls back to the
browser-local prototype store, so `npm run dev` works with no database at all.
**Set `VITE_API_URL=/api` in every deployed Vercel environment** — leaving it
unset there ships the localStorage prototype to production.

### Vercel

- **Database**: Neon via the Vercel Marketplace sets `DATABASE_URL` for you. Use
  the **pooled** connection string. Serverless functions open a connection per
  invocation; a direct endpoint exhausts its connection limit under trivial
  load. `server/db/client.ts` uses Neon's HTTP driver, which has no persistent
  connection to exhaust.
- **Functions**: one catch-all, `api/[...route].ts`. Hobby caps serverless
  functions at twelve and there are fifty-eight operations; one function also
  means one cold start rather than fifty-eight, and the security sequence lives
  in one readable place.
- **Headers**: `vercel.json` sends HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `frame-ancestors` and the CSP as real response headers —
  the things a `<meta>` CSP cannot carry.

---

## Request lifecycle

Every request follows the same path, and the order is the one `mockApi`
established:

```
api/[...route].ts
  ├─ CSRF: required custom header + origin check   (server/auth/csrf.ts)
  ├─ body: JSON, 128 KiB cap                       (server/http/json.ts)
  ├─ context: resolve session from cookie          (server/http/context.ts)
  ├─ route: operation name → handler               (server/http/router.ts)
  └─ handler
       ├─ ctx.limit(key)        rate limit BEFORE the expensive part
       ├─ ctx.requireFamily()   authorize
       ├─ …                     act
       └─ ctx.audit({...})      record, with PII stripped
```

Rate limiting comes before authorization deliberately: an unauthenticated
attacker hammering sign-in should be stopped by the limiter, not by the
expensive half of the auth check.

### Why everything is POST

Including reads. Filters belong in a body rather than a query string that ends
up in access logs and browser history; it means the CSRF check applies
uniformly with no "safe method" carve-out; and no response here is cacheable
anyway. `GET /api/health` is the one exception and says nothing about the
caller.

---

## What changed from the prototype

| Prototype | Now |
|---|---|
| Sessions in `localStorage` | `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie |
| `passwordHash: mock$<length>` | Argon2id (19 MiB, t=2, p=1) via `hash-wasm` |
| `projectFamily()` in the browser | Server-side, before serialisation |
| `guards.ts` advisory | Same module, enforced server-side |
| In-memory token buckets | Postgres buckets, shared across invocations |
| Notification bodies in English | `title_key` / `body_key` + vars |
| Demo sign-in always available | Refused whenever `VERCEL_ENV=production` |

The session token itself is never stored: the `sessions` table holds
`SHA-256(token ‖ pepper)`, so a dump of that table does not let the holder mint
a working cookie.

---

## Implemented vs pending

**Implemented against Postgres** — 24 of 58 operations:

- Auth: `signUp`, `signIn`, `signInAsDemo`, `signOut`, `getSession`,
  `getDeviceSessions`, `revokeDeviceSession`
- Verification: codes (issue, confirm, expiry, attempt caps), `setTwoFactor`,
  `startIdentityVerification`, `resolveMockVerification`, `getVerificationState`
- Family: `createFamily`, `getMyFamily`, `updateFamilyProfile`,
  `updatePreferences`, `updateAvailability`, `updatePrivacy`,
  `acceptSafetyGuidelines`
- Children: `addChild`, `updateChild`, `removeChild`
- Discovery: `discoverFamilies`, `excludedFamilies`, `getFamilyProjection`,
  `getDashboard`

**Pending** — registered in the router with their real guards, returning 501:
consent, messaging, playdates, safety, notifications, admin.

They are stubbed rather than absent so the authorization decision for each is
already made and reviewed. Finishing one means filling in a function body, not
deciding afresh who may call it. `mockApi.ts` is the reference implementation —
it already encodes the correct sequence and the business rules; porting means
swapping store reads for repository calls.

Suggested order: consent → messaging → playdates → safety → notifications →
admin. That is dependency order — messaging needs a connection to exist,
playdates need a conversation, and the admin views need cases to look at.

`resetPrototype` has no server route on purpose. Against a browser-local store
it wiped your own sandbox; against a shared database the same call means
"delete everyone's data".

---

## Schema notes

`server/db/schema.sql` is derived from `StoreState` and is close to 1:1 with it.
Three things it enforces that the prototype could only assert:

1. **Private identity data is a separate table.** Legal names, dates of birth,
   precise coordinates and home addresses live in `parent_identities` and
   nowhere else. No discovery query joins it.
2. **Children have no credentials.** There is no password, email, phone or
   session column on `children`, and no foreign key from `sessions` to it. A
   child cannot be an actor because no row shape permits it.
3. **`connections_ordered`** — `family_a_id < family_b_id` plus a unique index
   means a pair can only be connected once regardless of who asked.

Also worth knowing:

- `connection_requests_one_pending` is a partial unique index. It stops a
  block-then-unblock loop being used to spam a family with repeat requests.
- `families.is_demo` hard-excludes seeded families from real discovery.
- `audit_log` is append-only by convention **and should be by grant**: give the
  application role `INSERT` and `SELECT` there, never `UPDATE` or `DELETE`.

### Migrations

`npm run db:migrate` applies one idempotent file. That is the right amount of
machinery for a database with no production data in it.

**Replace it with a versioned migration tool before the first real user
exists.** A child-safety service cannot take "drop and recreate" as an option,
and you want the discipline in place before you need it.

---

## Still missing

Ordered by what blocks what. See `PROTOTYPE_DISCLOSURES.md` for the full list.

1. **Identity verification is still simulated.** `startIdentityVerification`
   writes `pending` and there is no code path that writes `verified` except a
   provider webhook that does not exist yet, or the demo resolver — which
   refuses to run in production. Wiring a real provider (Persona, Veriff,
   Stripe Identity) means an inquiry, a webhook endpoint with signature
   verification, and the failure, appeal and re-verification paths.
2. **No SMS or email delivery.** Codes are generated, hashed, attempt-capped and
   expired correctly; nothing sends them. Non-production echoes the code in the
   response so the flow is walkable. Production returns nothing — a code that
   reaches the browser is not a second factor.
3. **No account recovery.** Not even a "forgot password" link. Historically the
   most-exploited path in a product like this, so it needs designing
   deliberately: rate-limited, tokenised, and not a way to take over a verified
   parent's account.
4. **Coordinates are not geocoded.** `createFamily` stores a zero centroid
   rather than trusting a browser-supplied lat/lng, which is both untrusted and
   unnecessarily precise. Production geocodes the coarse area label server-side
   and stores the centroid of *that area*, never of a street address. Until
   then, distance scoring degrades to "unknown" rather than lying.
5. **No photo uploads.** `children.photo_ref` is a Blob key, not a URL. When
   this is built: EXIF stripping is mandatory — an un-stripped photo carries GPS
   coordinates and would defeat the entire location-privacy design in one upload
   — and CSAM scanning before a byte is stored is table stakes, not a later
   feature.
6. **Rate-limit buckets need pruning.** `pruneStaleBuckets()` exists; wire it to
   a Vercel Cron job or the table grows one row per (actor, action) forever.
7. **No right-to-erasure implementation.** `accounts.deleted_at` and
   `families.deleted_at` are the tombstone columns; the scrub-and-retain logic
   that keeps audit foreign keys valid is not written.
8. **No tests above the domain layer.** The 62 domain tests still pass and now
   cover shared code that runs on both sides. Nothing tests a handler, a guard
   boundary or a route. That is the first thing to add.
