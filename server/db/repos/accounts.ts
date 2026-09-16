import type { Account, ParentProfile, Role, TrustSignal, VerificationStatus } from '../../../src/domain/types';
import { buildTrustSignals } from '../../../src/domain/trust/signals';
import { sql } from '../client';

/**
 * Accounts, parent profiles and the private identity record.
 *
 * Note the deliberate asymmetry: `loadAccount` and `loadParentProfile` are used
 * everywhere, while `loadParentIdentity` has exactly two callers — the parent's
 * own verification page, and the moderation path, which writes an audit row
 * naming the case that justified the read. If you find yourself adding a third,
 * that is the moment to ask whether the data needs to travel at all.
 */

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  phone: string;
  role: Role;
  state: Account['state'];
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
  safety_guidelines_accepted_at: Date | null;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    role: row.role,
    state: row.state,
    emailVerified: row.email_verified,
    phoneVerified: row.phone_verified,
    twoFactorEnabled: row.two_factor_enabled,
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
    safetyGuidelinesAcceptedAt: row.safety_guidelines_accepted_at
      ? new Date(row.safety_guidelines_accepted_at).toISOString()
      : undefined,
  };
}

export async function loadAccount(accountId: string): Promise<Account | null> {
  const rows = (await sql`
    SELECT * FROM accounts WHERE id = ${accountId} AND deleted_at IS NULL LIMIT 1
  `) as unknown as AccountRow[];
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const rows = (await sql`
    SELECT * FROM accounts WHERE email = ${email.trim()} AND deleted_at IS NULL LIMIT 1
  `) as unknown as AccountRow[];
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function emailExists(email: string): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 FROM accounts WHERE email = ${email.trim()} AND deleted_at IS NULL LIMIT 1
  `) as unknown as unknown[];
  return rows.length > 0;
}

export async function touchLastLogin(accountId: string): Promise<void> {
  await sql`UPDATE accounts SET last_login_at = now() WHERE id = ${accountId}`;
}

export async function setAccountState(accountId: string, state: Account['state']): Promise<void> {
  await sql`UPDATE accounts SET state = ${state} WHERE id = ${accountId}`;
}

export async function setPasswordHash(accountId: string, hash: string): Promise<void> {
  await sql`UPDATE accounts SET password_hash = ${hash} WHERE id = ${accountId}`;
}

interface ParentRow {
  id: string;
  account_id: string;
  display_name: string;
  avatar_color: string;
  bio: string | null;
  joined_at: Date;
}

export async function loadParentProfile(parentId: string): Promise<ParentProfile | null> {
  const rows = (await sql`
    SELECT * FROM parent_profiles WHERE id = ${parentId} LIMIT 1
  `) as unknown as ParentRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    bio: row.bio ?? undefined,
    joinedAt: new Date(row.joined_at).toISOString(),
    trustSignals: [],
  };
}

export async function findParentIdByAccount(accountId: string): Promise<string | null> {
  const rows = (await sql`
    SELECT id FROM parent_profiles WHERE account_id = ${accountId} LIMIT 1
  `) as unknown as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function findFamilyIdByParent(parentId: string): Promise<string | null> {
  const rows = (await sql`
    SELECT family_id FROM family_memberships WHERE parent_id = ${parentId} LIMIT 1
  `) as unknown as Array<{ family_id: string }>;
  return rows[0]?.family_id ?? null;
}

export interface IdentityRecord {
  parentId: string;
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string | null;
  verificationStatus: VerificationStatus;
  verificationUpdatedAt: string | null;
  verificationFailureReason: string | null;
  verificationProvider: string | null;
}

/**
 * PRIVATE. Callers must have a reason that survives being written to the audit
 * log. Coordinates and home address are NOT selected here — nothing outside the
 * distance calculation ever needs them, and the query that does runs in
 * `families.ts` without returning them past its own function boundary.
 */
export async function loadParentIdentity(parentId: string): Promise<IdentityRecord | null> {
  const rows = (await sql`
    SELECT parent_id, legal_first_name, legal_last_name, date_of_birth,
           verification_status, verification_updated_at, verification_failure_reason,
           verification_provider
      FROM parent_identities WHERE parent_id = ${parentId} LIMIT 1
  `) as unknown as Array<{
    parent_id: string;
    legal_first_name: string;
    legal_last_name: string;
    date_of_birth: Date | null;
    verification_status: VerificationStatus;
    verification_updated_at: Date | null;
    verification_failure_reason: string | null;
    verification_provider: string | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    parentId: row.parent_id,
    legalFirstName: row.legal_first_name,
    legalLastName: row.legal_last_name,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().slice(0, 10) : null,
    verificationStatus: row.verification_status,
    verificationUpdatedAt: row.verification_updated_at
      ? new Date(row.verification_updated_at).toISOString()
      : null,
    verificationFailureReason: row.verification_failure_reason,
    verificationProvider: row.verification_provider,
  };
}

export async function setIdentityStatus(
  parentId: string,
  status: VerificationStatus,
  opts: { failureReason?: string | null; provider?: string | null } = {},
): Promise<void> {
  await sql`
    UPDATE parent_identities
       SET verification_status = ${status},
           verification_updated_at = now(),
           verification_failure_reason = ${opts.failureReason ?? null},
           verification_provider = COALESCE(${opts.provider ?? null}, verification_provider)
     WHERE parent_id = ${parentId}
  `;
}

/**
 * Trust signals for a parent.
 *
 * Computed from facts at read time rather than stored, which is the same
 * decision the prototype made: a stored score drifts from the facts that
 * justified it, and a score is exactly what this product refuses to show.
 */
export async function trustSignalsFor(input: {
  account: Account;
  profile: ParentProfile;
  identityStatus: VerificationStatus;
  completedPlaydates: number;
  secondaryParentVerified: boolean;
  profileComplete: boolean;
  upheldReports: number;
}): Promise<TrustSignal[]> {
  const joined = new Date(input.profile.joinedAt);
  const months = Math.max(
    0,
    Math.floor((Date.now() - joined.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  );

  return buildTrustSignals({
    emailVerified: input.account.emailVerified,
    phoneVerified: input.account.phoneVerified,
    idVerification: input.identityStatus,
    twoFactorEnabled: input.account.twoFactorEnabled,
    secondaryParentVerified: input.secondaryParentVerified,
    profileComplete: input.profileComplete,
    accountAgeMonths: months,
    completedPlaydates: input.completedPlaydates,
    upheldReports: input.upheldReports,
    joinedAt: input.profile.joinedAt,
  });
}

/** How many playdates this family has actually completed. Feeds a trust signal. */
export async function completedPlaydateCount(familyId: string): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS n FROM playdates
     WHERE status = 'completed' AND (family_a_id = ${familyId} OR family_b_id = ${familyId})
  `) as unknown as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/** Reports against this family that a moderator upheld. Never a public number. */
export async function upheldReportCount(familyId: string): Promise<number> {
  const rows = (await sql`
    SELECT count(DISTINCT c.id)::int AS n
      FROM moderation_cases c
      JOIN moderation_actions a ON a.case_id = c.id
     WHERE c.reported_family_id = ${familyId}
       AND a.kind NOT IN ('no_action', 'dismiss')
  `) as unknown as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
