import { randomInt } from 'node:crypto';
import type { VerificationStatus } from '../../src/domain/types';
import { validateVerificationCode } from '../../src/domain/validation';
import { sql, newId } from '../db/client';
import { loadParentIdentity, setIdentityStatus } from '../db/repos/accounts';
import { setFamilyVerification } from '../db/repos/families';
import { hashCode } from '../auth/sessions';
import { env } from '../env';
import type { RequestContext } from '../http/context';
import { BadRequestError, ForbiddenError, NotFoundError } from '../http/errors';
import { bool, literal, str } from './input';

/**
 * Verification.
 *
 * The prototype simulated all of this. What is real here is the *workflow* —
 * code issue, attempt caps, expiry, state transitions, the gate on discovery.
 * What is still simulated is the identity check itself, and the shape of the
 * code says so: `startIdentityVerification` writes `pending` and there is no
 * code path that writes `verified` except an explicit provider callback that
 * does not exist yet, or the demo resolver below, which refuses to run in
 * production.
 *
 * That is the honest position. A prototype that flips a parent to "verified"
 * because a button was pressed is lying to every other parent on the platform.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function issueCode(ctx: RequestContext, channel: 'email' | 'phone'): Promise<{ hint: string }> {
  const session = ctx.requireSession();
  await ctx.limit('verification_code');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  // Supersede any outstanding code for this channel so two live codes cannot
  // both be guessed against.
  await sql`
    UPDATE verification_codes SET consumed_at = now()
     WHERE account_id = ${session.accountId} AND channel = ${channel} AND consumed_at IS NULL
  `;
  await sql`
    INSERT INTO verification_codes (id, account_id, channel, code_hash, expires_at)
    VALUES (
      ${newId('vc')}, ${session.accountId}, ${channel}, ${hashCode(code)},
      ${new Date(Date.now() + CODE_TTL_MS).toISOString()}
    )
  `;

  await ctx.audit({ action: `verification.${channel}_code_sent` });

  // TODO(delivery): hand `code` to the SMS/email provider. Until one is wired,
  // non-production environments echo it so the flow is walkable, and production
  // returns nothing — a code that reaches the browser is not a second factor.
  if (env.isProduction) {
    return { hint: 'We have sent you a code.' };
  }
  return { hint: `Development only — your code is ${code}.` };
}

export async function sendEmailCode(ctx: RequestContext): Promise<{ hint: string }> {
  return issueCode(ctx, 'email');
}

export async function sendPhoneCode(ctx: RequestContext): Promise<{ hint: string }> {
  return issueCode(ctx, 'phone');
}

async function confirmCode(ctx: RequestContext, channel: 'email' | 'phone'): Promise<null> {
  const session = ctx.requireSession();
  await ctx.limit('verification_code');

  const code = str(ctx.body, 'code', { max: 12 }).trim();
  const error = validateVerificationCode(code);
  if (error) throw new BadRequestError(error.key, 'code', error.key);

  const rows = (await sql`
    SELECT id, code_hash, attempts, expires_at
      FROM verification_codes
     WHERE account_id = ${session.accountId} AND channel = ${channel} AND consumed_at IS NULL
     ORDER BY expires_at DESC
     LIMIT 1
  `) as unknown as Array<{ id: string; code_hash: string; attempts: number; expires_at: Date }>;

  const record = rows[0];
  if (!record || new Date(record.expires_at).getTime() < Date.now()) {
    throw new BadRequestError('That code has expired. Please request a new one.', 'code', 'code_expired');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new ForbiddenError('Too many incorrect attempts. Please request a new code.', 'code_attempts_exceeded');
  }

  if (record.code_hash !== hashCode(code)) {
    await sql`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ${record.id}`;
    await ctx.audit({ action: `verification.${channel}_code_failed` });
    throw new BadRequestError('That code is not correct.', 'code', 'code_incorrect');
  }

  await sql`UPDATE verification_codes SET consumed_at = now() WHERE id = ${record.id}`;
  if (channel === 'email') {
    await sql`UPDATE accounts SET email_verified = TRUE WHERE id = ${session.accountId}`;
  } else {
    await sql`UPDATE accounts SET phone_verified = TRUE WHERE id = ${session.accountId}`;
  }

  await ctx.audit({ action: `verification.${channel}_confirmed` });
  return null;
}

export async function confirmEmailCode(ctx: RequestContext): Promise<null> {
  return confirmCode(ctx, 'email');
}

export async function confirmPhoneCode(ctx: RequestContext): Promise<null> {
  return confirmCode(ctx, 'phone');
}

export async function setTwoFactor(ctx: RequestContext): Promise<null> {
  const session = ctx.requireSession();
  const enabled = bool(ctx.body, 'enabled');
  await sql`UPDATE accounts SET two_factor_enabled = ${enabled} WHERE id = ${session.accountId}`;
  await ctx.audit({ action: enabled ? 'security.2fa_enabled' : 'security.2fa_disabled' });
  return null;
}

export async function startIdentityVerification(
  ctx: RequestContext,
): Promise<{ status: VerificationStatus }> {
  const session = ctx.requireSession();
  await ctx.limit('verification_code');

  const legalFirstName = str(ctx.body, 'legalFirstName', { max: 80 }).trim();
  const legalLastName = str(ctx.body, 'legalLastName', { max: 80 }).trim();
  const dateOfBirth = str(ctx.body, 'dateOfBirth', { max: 10 }).trim();

  if (!legalFirstName || !legalLastName) {
    throw new BadRequestError('Please enter your legal name as it appears on your ID.', 'legalFirstName');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new BadRequestError('Please enter a valid date of birth.', 'dateOfBirth');
  }

  const age = yearsSince(dateOfBirth);
  if (age < 18) {
    throw new ForbiddenError('You must be 18 or over to create a family account.', 'under_18');
  }

  await sql`
    UPDATE parent_identities
       SET legal_first_name = ${legalFirstName},
           legal_last_name = ${legalLastName},
           date_of_birth = ${dateOfBirth}::date,
           verification_status = 'pending',
           verification_provider = ${env.allowDemoMode ? 'mock' : null},
           verification_updated_at = now(),
           verification_failure_reason = NULL
     WHERE parent_id = ${session.parentId}
  `;
  if (session.familyId) await setFamilyVerification(session.familyId, 'pending');

  // Audited WITHOUT the name or date of birth. The audit log records that a
  // check started, never the identity data that started it.
  await ctx.audit({ action: 'verification.identity_started' });

  // TODO(provider): create an inquiry with the identity provider and store its
  // reference in verification_provider_ref. The provider's webhook — not this
  // request — is what may later write 'verified'.
  return { status: 'pending' };
}

/**
 * Resolve the simulated check.
 *
 * Exists so the demo is walkable. `env.allowDemoMode` is false whenever
 * VERCEL_ENV is production, regardless of the variable's value, so this cannot
 * be turned on by a misconfiguration.
 */
export async function resolveMockVerification(ctx: RequestContext): Promise<null> {
  if (!env.allowDemoMode) {
    throw new ForbiddenError(
      'Simulated verification is disabled in this environment. Connect an identity provider.',
      'demo_disabled',
    );
  }
  const session = ctx.requireSession();
  const outcome = literal(ctx.body, 'outcome', ['verified', 'failed'] as const);

  await setIdentityStatus(session.parentId, outcome, {
    provider: 'mock',
    failureReason: outcome === 'failed' ? 'Simulated failure.' : null,
  });
  if (session.familyId) await setFamilyVerification(session.familyId, outcome);
  if (outcome === 'verified') {
    await sql`UPDATE accounts SET state = 'active' WHERE id = ${session.accountId} AND state = 'verification_required'`;
  }

  await ctx.audit({ action: 'verification.mock_resolved', metadata: { outcome } });
  return null;
}

export async function getVerificationState(ctx: RequestContext) {
  const { session, account } = await ctx.requireAccount();
  const identity = await loadParentIdentity(session.parentId);
  if (!identity) throw new NotFoundError('No identity record for this parent.');

  return {
    emailVerified: account.emailVerified,
    phoneVerified: account.phoneVerified,
    twoFactorEnabled: account.twoFactorEnabled,
    identityStatus: identity.verificationStatus,
    identityUpdatedAt: identity.verificationUpdatedAt ?? undefined,
    failureReason: identity.verificationFailureReason ?? undefined,
    provider: identity.verificationProvider ?? undefined,
    // The client shows a prominent disclosure when this is true. It stays true
    // until a real provider is connected.
    isMockProvider: identity.verificationProvider === 'mock' || env.allowDemoMode,
  };
}

function yearsSince(isoDate: string): number {
  const dob = new Date(isoDate);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years;
}
