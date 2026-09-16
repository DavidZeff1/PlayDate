-- ===========================================================================
-- PlayDate — Postgres schema
--
-- Derived directly from `StoreState` in src/services/mock/store.ts, which was
-- deliberately shaped like a database: normalised collections, explicit ids,
-- no aggregate nested inside another. The translation is close to 1:1.
--
-- Three rules this schema enforces that the prototype could only assert:
--
--  1. Private identity data lives in `parent_identities`, a separate table with
--     a separate access path. Nothing in the discovery query plan touches it.
--     Legal names, dates of birth, precise coordinates and home addresses are
--     here and nowhere else.
--  2. Children have no credentials. There is no password, email, phone or
--     session column on `children`, and no foreign key from `sessions` to it.
--     A child cannot be an actor because there is no row shape that would let
--     them be one.
--  3. Notifications store translation KEYS, not sentences. A stored English
--     string is a notification that can only ever be read in English.
--
-- Apply with:  npm run db:migrate
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations. Kept as CHECK constraints rather than PG enums: adding a value
-- to a PG enum cannot run inside a transaction with other DDL, which makes
-- migrations awkward for something that will gain values (report reasons,
-- moderation actions) over time.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Accounts and parents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id                            TEXT PRIMARY KEY,
  email                         CITEXT NOT NULL UNIQUE,
  -- Argon2id, produced server-side. The client never sees this column and
  -- never sends a hash; it sends a password once, over TLS, to an endpoint
  -- that does not log its body.
  password_hash                 TEXT NOT NULL,
  phone                         TEXT NOT NULL DEFAULT '',
  role                          TEXT NOT NULL DEFAULT 'parent'
                                  CHECK (role IN ('parent','moderator','verification_agent','admin')),
  state                         TEXT NOT NULL DEFAULT 'verification_required'
                                  CHECK (state IN ('active','verification_required','under_review','restricted','suspended','banned')),
  email_verified                BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified                BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at                 TIMESTAMPTZ,
  safety_guidelines_accepted_at TIMESTAMPTZ,
  -- Soft-delete for right-to-erasure: the row is scrubbed and tombstoned so
  -- foreign keys in audit_log stay valid. See docs/BACKEND.md.
  deleted_at                    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS accounts_state_idx ON accounts (state) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS parent_profiles (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#7C6BF0',
  bio          TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_profiles_account_idx ON parent_profiles (account_id);

-- PRIVATE. Never joined into a discovery query. Readable by the parent
-- themselves, or by a verification agent acting on an open case — and that
-- read writes an audit_log row naming the case.
CREATE TABLE IF NOT EXISTS parent_identities (
  parent_id                   TEXT PRIMARY KEY REFERENCES parent_profiles (id) ON DELETE CASCADE,
  legal_first_name            TEXT NOT NULL DEFAULT '',
  legal_last_name             TEXT NOT NULL DEFAULT '',
  date_of_birth               DATE,
  -- An opaque reference from the identity provider. We never store ID images,
  -- and this column must never hold a document number.
  verification_provider_ref   TEXT,
  verification_provider       TEXT CHECK (verification_provider IN ('mock','persona','stripe_identity','veriff')),
  verification_status         TEXT NOT NULL DEFAULT 'unstarted'
                                CHECK (verification_status IN ('unstarted','required','pending','verified','failed','expired')),
  verification_updated_at     TIMESTAMPTZ,
  verification_failure_reason TEXT,
  -- Precise coordinates, stored once because distance maths needs them.
  -- NEVER selected by any cross-family query — distance leaves this database
  -- only as a band. See server/handlers/discovery.ts.
  precise_lat                 DOUBLE PRECISION,
  precise_lng                 DOUBLE PRECISION,
  home_address                TEXT
);

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS families (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  general_area        TEXT NOT NULL DEFAULT '',
  neighborhood        TEXT,
  approx_lat          DOUBLE PRECISION NOT NULL DEFAULT 0,
  approx_lng          DOUBLE PRECISION NOT NULL DEFAULT 0,
  about               TEXT,
  languages           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL DEFAULT 'unstarted'
                        CHECK (verification_status IN ('unstarted','required','pending','verified','failed','expired')),
  account_state       TEXT NOT NULL DEFAULT 'verification_required'
                        CHECK (account_state IN ('active','verification_required','under_review','restricted','suspended','banned')),
  -- Seeded demonstration families. Hard-excluded from discovery for real
  -- accounts: fictional children must never appear in a real parent's feed.
  is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS families_discoverable_idx
  ON families (verification_status, account_state)
  WHERE deleted_at IS NULL AND is_demo = FALSE;

CREATE TABLE IF NOT EXISTS family_memberships (
  parent_id TEXT NOT NULL REFERENCES parent_profiles (id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','secondary')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, family_id)
);

CREATE INDEX IF NOT EXISTS family_memberships_family_idx ON family_memberships (family_id);

CREATE TABLE IF NOT EXISTS family_preferences (
  family_id             TEXT PRIMARY KEY REFERENCES families (id) ON DELETE CASCADE,
  max_travel_km         INTEGER NOT NULL DEFAULT 10 CHECK (max_travel_km BETWEEN 1 AND 100),
  age_flexibility_years INTEGER NOT NULL DEFAULT 2 CHECK (age_flexibility_years BETWEEN 0 AND 6),
  w_interests           SMALLINT NOT NULL DEFAULT 4 CHECK (w_interests BETWEEN 1 AND 5),
  w_age                 SMALLINT NOT NULL DEFAULT 4 CHECK (w_age BETWEEN 1 AND 5),
  w_distance            SMALLINT NOT NULL DEFAULT 3 CHECK (w_distance BETWEEN 1 AND 5),
  w_availability        SMALLINT NOT NULL DEFAULT 3 CHECK (w_availability BETWEEN 1 AND 5),
  w_style               SMALLINT NOT NULL DEFAULT 3 CHECK (w_style BETWEEN 1 AND 5),
  styles                TEXT[] NOT NULL DEFAULT '{}',
  preferred_activities  TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS family_privacy (
  family_id                   TEXT PRIMARY KEY REFERENCES families (id) ON DELETE CASCADE,
  location                    TEXT NOT NULL DEFAULT 'general_area'
                                CHECK (location IN ('hidden','general_area','neighborhood','approximate_distance')),
  child_name                  TEXT NOT NULL DEFAULT 'first_name'
                                CHECK (child_name IN ('hidden','first_name','nickname')),
  child_photos                TEXT NOT NULL DEFAULT 'hidden'
                                CHECK (child_photos IN ('hidden','on_request','connected_families')),
  child_ages                  TEXT NOT NULL DEFAULT 'exact' CHECK (child_ages IN ('exact','range')),
  discoverable                BOOLEAN NOT NULL DEFAULT TRUE,
  availability_detail         TEXT NOT NULL DEFAULT 'summary' CHECK (availability_detail IN ('summary','detailed')),
  parent_bio                  TEXT NOT NULL DEFAULT 'connected_only' CHECK (parent_bio IN ('connected_only','discovery')),
  require_verified_to_request BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS family_availability (
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  day       TEXT NOT NULL CHECK (day IN ('sun','mon','tue','wed','thu','fri','sat')),
  block     TEXT NOT NULL CHECK (block IN ('morning','afternoon','evening')),
  PRIMARY KEY (family_id, day, block)
);

-- ---------------------------------------------------------------------------
-- Children
--
-- Note what is absent: no email, no phone, no password, no session, no date of
-- birth. Age is stored in years on purpose — a DOB is an identifier, an age is
-- a matching input.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS children (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL,
  nickname     TEXT,
  age          SMALLINT NOT NULL CHECK (age BETWEEN 0 AND 18),
  pronouns     TEXT,
  notes        TEXT,
  energy       SMALLINT CHECK (energy BETWEEN 1 AND 5),
  sociability  SMALLINT CHECK (sociability BETWEEN 1 AND 5),
  avatar_color TEXT NOT NULL DEFAULT '#7C6BF0',
  -- Blob key, not a URL. Photos are served through a signed, short-lived URL
  -- issued only to a viewer who has passed the consent check, and are EXIF
  -- stripped on upload. Not yet implemented — see docs/BACKEND.md.
  photo_ref    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order   SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS children_family_idx ON children (family_id);

CREATE TABLE IF NOT EXISTS child_interests (
  child_id    TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL,
  enthusiasm  SMALLINT NOT NULL CHECK (enthusiasm BETWEEN 1 AND 5),
  importance  SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 5),
  PRIMARY KEY (child_id, interest_id)
);

CREATE INDEX IF NOT EXISTS child_interests_interest_idx ON child_interests (interest_id);

-- ---------------------------------------------------------------------------
-- Consent: requests, connections, blocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS connection_requests (
  id             TEXT PRIMARY KEY,
  from_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  to_family_id   TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','deferred','withdrawn','expired')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at   TIMESTAMPTZ,
  match_summary  TEXT,
  CONSTRAINT connection_requests_not_self CHECK (from_family_id <> to_family_id)
);

-- One live request per direction. Stops a blocked-then-unblocked loop being
-- used to spam a family with repeat requests.
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_pending
  ON connection_requests (from_family_id, to_family_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS connection_requests_to_idx ON connection_requests (to_family_id, status);
CREATE INDEX IF NOT EXISTS connection_requests_from_idx ON connection_requests (from_family_id, status);

CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  family_a_id     TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  family_b_id     TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  state           TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','left','closed'))
);

CREATE TABLE IF NOT EXISTS connections (
  id              TEXT PRIMARY KEY,
  family_a_id     TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  family_b_id     TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  state           TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','left','blocked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- family_a_id is always the lexicographically smaller id, so a pair can only
  -- be connected once regardless of who asked.
  CONSTRAINT connections_ordered CHECK (family_a_id < family_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_pair ON connections (family_a_id, family_b_id);
CREATE INDEX IF NOT EXISTS connections_a_idx ON connections (family_a_id) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS connections_b_idx ON connections (family_b_id) WHERE state = 'active';

CREATE TABLE IF NOT EXISTS blocks (
  blocker_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  blocked_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason            TEXT,
  PRIMARY KEY (blocker_family_id, blocked_family_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked_family_id);

-- ---------------------------------------------------------------------------
-- Messaging — parent to parent only
--
-- sender_parent_id references parent_profiles. There is no column that could
-- hold a child id, which is the structural half of "children cannot message".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_parent_id TEXT NOT NULL REFERENCES parent_profiles (id) ON DELETE CASCADE,
  sender_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  body             TEXT NOT NULL CHECK (length(body) <= 2000),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Advisory scan results. Never auto-punitive; a flag prompts the sender and
  -- is evidence a moderator can see if a case is later opened.
  safety_flags     JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, sent_at);

CREATE TABLE IF NOT EXISTS conversation_reads (
  family_id       TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, conversation_id)
);

-- ---------------------------------------------------------------------------
-- PlayDates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS playdates (
  id                     TEXT PRIMARY KEY,
  connection_id          TEXT NOT NULL REFERENCES connections (id) ON DELETE CASCADE,
  family_a_id            TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  family_b_id            TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  proposed_by_family_id  TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  activity               TEXT NOT NULL DEFAULT '',
  -- { label, kind, area, isPublic }. Never a home address: `label` is a
  -- parent-chosen venue name and is scanned like message bodies are.
  place                  JSONB NOT NULL,
  starts_at              TIMESTAMPTZ NOT NULL,
  duration_minutes       INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes BETWEEN 15 AND 480),
  status                 TEXT NOT NULL DEFAULT 'proposed'
                           CHECK (status IN ('proposed','confirmed','declined','cancelled','completed')),
  notes                  TEXT,
  adult_present          JSONB NOT NULL DEFAULT '{}'::jsonb,
  attendees              JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared_with            JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_meeting_feedback  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playdates_a_idx ON playdates (family_a_id, starts_at);
CREATE INDEX IF NOT EXISTS playdates_b_idx ON playdates (family_b_id, starts_at);

-- ---------------------------------------------------------------------------
-- Reporting and moderation
--
-- A report never changes an account state. Only a moderation_action row does,
-- written by a person, with a rationale. See docs/ARCHITECTURE.md §2.3.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS moderation_cases (
  id                 TEXT PRIMARY KEY,
  reported_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','actioned','dismissed')),
  priority           TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_cases_open_idx ON moderation_cases (status, priority, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id                  TEXT PRIMARY KEY,
  reporter_family_id  TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  reported_family_id  TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  reason              TEXT NOT NULL
                        CHECK (reason IN ('suspicious_behavior','fake_identity','harassment','inappropriate_messages',
                                          'misrepresentation','unwanted_contact','safety_concern','inappropriate_content',
                                          'child_safety_urgent')),
  details             TEXT NOT NULL DEFAULT '',
  evidence_message_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  case_id             TEXT NOT NULL REFERENCES moderation_cases (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reports_case_idx ON reports (case_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_family_id);

CREATE TABLE IF NOT EXISTS moderation_notes (
  id      TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES moderation_cases (id) ON DELETE CASCADE,
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  by      TEXT NOT NULL,
  body    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS moderation_notes_case_idx ON moderation_notes (case_id, at);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id        TEXT PRIMARY KEY,
  case_id   TEXT NOT NULL REFERENCES moderation_cases (id) ON DELETE CASCADE,
  kind      TEXT NOT NULL
              CHECK (kind IN ('no_action','warning_issued','require_reverification','restrict_account',
                              'suspend_account','ban_account','dismiss')),
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  by        TEXT NOT NULL,
  rationale TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS moderation_actions_case_idx ON moderation_actions (case_id, at);

-- ---------------------------------------------------------------------------
-- Notifications
--
-- Keys and variables, never sentences. The prototype's mock stored English
-- prose here, which meant a Hebrew-reading parent got English notifications.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL
               CHECK (kind IN ('connection_request','request_accepted','new_message','playdate_proposed',
                               'playdate_confirmed','playdate_reminder','verification_update','safety_notice',
                               'moderation_update')),
  title_key  TEXT NOT NULL,
  title_vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_key   TEXT NOT NULL,
  body_vars  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  href       TEXT
);

CREATE INDEX IF NOT EXISTS notifications_family_idx ON notifications (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (family_id) WHERE read = FALSE;

-- ---------------------------------------------------------------------------
-- Sessions
--
-- The token itself is never stored. We keep SHA-256(token || pepper), so a
-- dump of this table does not let the holder mint a session. `family_id` is
-- nullable because a parent exists before their family does, and there is no
-- child variant of this row — see src/domain/types.ts `Session`.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  token_hash          TEXT NOT NULL UNIQUE,
  account_id          TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  parent_id           TEXT NOT NULL REFERENCES parent_profiles (id) ON DELETE CASCADE,
  family_id           TEXT REFERENCES families (id) ON DELETE SET NULL,
  role                TEXT NOT NULL CHECK (role IN ('parent','moderator','verification_agent','admin')),
  device_label        TEXT NOT NULL DEFAULT 'Unknown device',
  -- Truncated, salted hash. Enough to say "a different device signed in",
  -- never enough to reconstruct where a family lives.
  ip_hash             TEXT,
  approx_location     TEXT NOT NULL DEFAULT 'Unknown',
  user_agent          TEXT,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id) WHERE revoked_at IS NULL;

-- One-time codes for email and phone confirmation. Hashed, attempt-capped and
-- short-lived; the plaintext exists only in the SMS or email that carried it.
CREATE TABLE IF NOT EXISTS verification_codes (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','phone')),
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS verification_codes_lookup
  ON verification_codes (account_id, channel, expires_at DESC)
  WHERE consumed_at IS NULL;

-- Per-viewer photo consent. Absence of a row means no.
CREATE TABLE IF NOT EXISTS photo_consents (
  viewer_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  target_family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_family_id, target_family_id)
);

-- ---------------------------------------------------------------------------
-- Audit log
--
-- Append-only by convention and by grant: the application role has INSERT and
-- SELECT here and no UPDATE or DELETE. `target` and `metadata` pass through
-- redactForLog() before they are written.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor      TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('parent','moderator','verification_agent','admin','system')),
  action     TEXT NOT NULL,
  target     TEXT,
  case_id    TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor, at DESC);

-- ---------------------------------------------------------------------------
-- Rate limiting
--
-- Token buckets, shared across function invocations. Postgres is used so the
-- scaffold needs one service rather than two; at scale this moves to Upstash
-- Redis with the same bucket semantics. See server/rateLimit.ts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  tokens     DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_stale_idx ON rate_limit_buckets (updated_at);
