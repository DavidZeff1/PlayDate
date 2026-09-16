import type { DeviceSession, Session } from '../../src/domain/types';
import { validateEmail, validatePassword, validatePhone } from '../../src/domain/validation';
import { sql, newId } from '../db/client';
import {
  emailExists,
  findAccountByEmail,
  findFamilyIdByParent,
  findParentIdByAccount,
  loadAccount,
  setPasswordHash,
  touchLastLogin,
} from '../db/repos/accounts';
import { burnPasswordTime, hashPassword, needsRehash, verifyPassword } from '../auth/password';
import { clearedSessionCookie, sessionCookie } from '../auth/cookies';
import { hashIp, issueSession, revokeSession } from '../auth/sessions';
import { approxLocationFrom, deviceLabelFrom, type RequestContext } from '../http/context';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthenticatedError } from '../http/errors';
import { env } from '../env';
import { str } from './input';

/**
 * Authentication.
 *
 * Two asymmetries here are deliberate and worth not "tidying up" later:
 *
 *  - **Sign-up is specific, sign-in is vague.** A signup form that says "that
 *    email is taken" is usable; a sign-in that distinguishes "no such account"
 *    from "wrong password" is an account-enumeration oracle. On a platform
 *    where merely confirming somebody is a parent here is sensitive, that
 *    matters more than the marginal UX.
 *
 *  - **Failed sign-in still burns hashing time.** Otherwise "no such account"
 *    returns in microseconds and "wrong password" takes ~50ms, and the timing
 *    difference rebuilds the oracle the error message just closed.
 */

export async function signUp(ctx: RequestContext): Promise<{ session: Session }> {
  await ctx.limit('login');

  const email = str(ctx.body, 'email').trim().toLowerCase();
  const phone = str(ctx.body, 'phone').trim();
  const password = str(ctx.body, 'password');

  for (const [error, field] of [
    [validateEmail(email), 'email'],
    [validatePhone(phone), 'phone'],
    [validatePassword(password), 'password'],
  ] as const) {
    if (error) throw new BadRequestError(error.key, field, error.key);
  }

  if (await emailExists(email)) {
    throw new BadRequestError('An account already exists with that email address.', 'email', 'email_taken');
  }

  const accountId = newId('acc');
  const parentId = newId('par');
  const passwordHash = await hashPassword(password);

  await sql`
    INSERT INTO accounts (id, email, password_hash, phone, role, state)
    VALUES (${accountId}, ${email}, ${passwordHash}, ${phone}, 'parent', 'verification_required')
  `;
  await sql`
    INSERT INTO parent_profiles (id, account_id, display_name, avatar_color)
    VALUES (${parentId}, ${accountId}, '', '#7C6BF0')
  `;
  await sql`
    INSERT INTO parent_identities (parent_id, verification_status)
    VALUES (${parentId}, 'unstarted')
  `;

  const issued = await issueSession({
    accountId,
    parentId,
    familyId: null,
    role: 'parent',
    deviceLabel: deviceLabelFrom(ctx.userAgent),
    ipHash: hashIp(ctx.ip),
    approxLocation: approxLocationFrom(ctx.ip),
    userAgent: ctx.userAgent,
  });

  ctx.setHeader('Set-Cookie', sessionCookie(issued.token, issued.maxAgeMs));
  await ctx.audit({ actor: accountId, actorRole: 'parent', action: 'account.created' });

  return { session: issued.session };
}

export async function signIn(ctx: RequestContext): Promise<{ session: Session }> {
  const email = str(ctx.body, 'email').trim().toLowerCase();
  const password = str(ctx.body, 'password');

  // Keyed on the submitted email, so guessing against one account cannot lock
  // out an unrelated one — and credential stuffing across many accounts still
  // pays the cost.
  await ctx.limit('login', `email:${email || 'anon'}`);

  const account = email ? await findAccountByEmail(email) : null;

  if (!account) {
    await burnPasswordTime();
    await ctx.audit({ actor: 'unknown', actorRole: 'system', action: 'auth.failed' });
    throw new UnauthenticatedError('Email or password is incorrect.', 'bad_credentials');
  }

  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) {
    await ctx.audit({ actor: account.id, actorRole: 'system', action: 'auth.failed' });
    throw new UnauthenticatedError('Email or password is incorrect.', 'bad_credentials');
  }

  if (account.state === 'banned' || account.state === 'suspended') {
    throw new ForbiddenError('This account is not available. Please contact support.', account.state);
  }

  // Opportunistic upgrade: the only moment we legitimately hold the plaintext.
  if (needsRehash(account.passwordHash)) {
    await setPasswordHash(account.id, await hashPassword(password));
  }

  const parentId = (await findParentIdByAccount(account.id)) ?? '';
  const familyId = parentId ? await findFamilyIdByParent(parentId) : null;

  const issued = await issueSession({
    accountId: account.id,
    parentId,
    familyId,
    role: account.role,
    deviceLabel: deviceLabelFrom(ctx.userAgent),
    ipHash: hashIp(ctx.ip),
    approxLocation: approxLocationFrom(ctx.ip),
    userAgent: ctx.userAgent,
  });

  await touchLastLogin(account.id);
  ctx.setHeader('Set-Cookie', sessionCookie(issued.token, issued.maxAgeMs));
  await ctx.audit({ actor: account.id, actorRole: account.role, action: 'auth.signed_in' });

  return { session: issued.session };
}

/**
 * Demo sign-in.
 *
 * Refused outright in production — see `env.allowDemoMode`. A button that hands
 * out a session to a pre-verified family is fine in a sandbox and indefensible
 * on a service that tells parents verification means something.
 */
export async function signInAsDemo(ctx: RequestContext): Promise<{ session: Session }> {
  if (!env.allowDemoMode) {
    throw new ForbiddenError(
      'Demo sign-in is disabled in this environment.',
      'demo_disabled',
    );
  }
  await ctx.limit('login');

  const rows = (await sql`
    SELECT a.id AS account_id, p.id AS parent_id, m.family_id
      FROM accounts a
      JOIN parent_profiles p ON p.account_id = a.id
      JOIN family_memberships m ON m.parent_id = p.id
      JOIN families f ON f.id = m.family_id
     WHERE f.is_demo = TRUE AND a.deleted_at IS NULL
     ORDER BY a.created_at
     LIMIT 1
  `) as unknown as Array<{ account_id: string; parent_id: string; family_id: string }>;

  const demo = rows[0];
  if (!demo) {
    throw new NotFoundError('No demo family is seeded in this environment.', 'no_demo_data');
  }

  const account = await loadAccount(demo.account_id);
  const issued = await issueSession({
    accountId: demo.account_id,
    parentId: demo.parent_id,
    familyId: demo.family_id,
    role: account?.role ?? 'parent',
    deviceLabel: deviceLabelFrom(ctx.userAgent),
    ipHash: hashIp(ctx.ip),
    approxLocation: approxLocationFrom(ctx.ip),
    userAgent: ctx.userAgent,
  });

  ctx.setHeader('Set-Cookie', sessionCookie(issued.token, issued.maxAgeMs));
  await ctx.audit({ actor: demo.account_id, actorRole: 'parent', action: 'auth.demo_signed_in' });
  return { session: issued.session };
}

export async function signOut(ctx: RequestContext): Promise<null> {
  await revokeSession(ctx.rawToken);
  ctx.setHeader('Set-Cookie', clearedSessionCookie());
  if (ctx.session) {
    await ctx.audit({ action: 'auth.signed_out' });
  }
  return null;
}

/** Null rather than 401 when signed out: the client calls this on every boot. */
export async function getSession(ctx: RequestContext): Promise<Session | null> {
  return ctx.session;
}

export async function getDeviceSessions(ctx: RequestContext): Promise<DeviceSession[]> {
  const session = ctx.requireSession();
  const rows = (await sql`
    SELECT id, device_label, approx_location, last_seen_at
      FROM sessions
     WHERE account_id = ${session.accountId} AND revoked_at IS NULL
     ORDER BY last_seen_at DESC
     LIMIT 20
  `) as unknown as Array<{
    id: string;
    device_label: string;
    approx_location: string;
    last_seen_at: Date;
  }>;

  // "Current" is the row this request authenticated against. No token or token
  // hash leaves the server — the client gets an opaque row id it can revoke.
  return rows.map((r) => ({
    id: r.id,
    label: r.device_label,
    lastSeenAt: new Date(r.last_seen_at).toISOString(),
    location: r.approx_location,
    current: r.id === ctx.currentSessionId,
  }));
}

export async function revokeDeviceSession(ctx: RequestContext): Promise<null> {
  const session = ctx.requireSession();
  const id = str(ctx.body, 'id');

  // Scoped to the caller's own account: a session id from elsewhere must not be
  // revocable just because you know it.
  const rows = (await sql`
    UPDATE sessions SET revoked_at = now()
     WHERE id = ${id} AND account_id = ${session.accountId} AND revoked_at IS NULL
     RETURNING id
  `) as unknown as Array<{ id: string }>;

  if (rows.length === 0) throw new NotFoundError('That device session was not found.');
  await ctx.audit({ action: 'session.revoked', target: id });
  return null;
}
