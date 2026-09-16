import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Role, Session } from '../../src/domain/types';
import { sql, newId } from '../db/client';
import { env } from '../env';
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from './cookies';

/**
 * Server-side sessions.
 *
 * The token the browser holds is 32 random bytes. What we store is
 * SHA-256(token || pepper) — so a dump of the `sessions` table does not let the
 * holder mint a working cookie, and neither does read access to a backup.
 *
 * Two expiries, because they defend different things:
 *   - idle (30 min, sliding) limits the window on a shared or walked-away-from
 *     device;
 *   - absolute (30 days) means a stolen cookie dies on its own even if the
 *     thief keeps it warm with traffic.
 */

const pepper = createHash('sha256').update(env.sessionSecret).digest();

function hashToken(token: string): string {
  return createHash('sha256').update(token).update(pepper).digest('hex');
}

export interface SessionRow {
  id: string;
  account_id: string;
  parent_id: string;
  family_id: string | null;
  role: Role;
  device_label: string;
  issued_at: Date;
  last_seen_at: Date;
  absolute_expires_at: Date;
}

export interface IssuedSession {
  token: string;
  session: Session;
  maxAgeMs: number;
}

export async function issueSession(input: {
  accountId: string;
  parentId: string;
  familyId: string | null;
  role: Role;
  deviceLabel: string;
  ipHash: string | null;
  approxLocation: string;
  userAgent: string | null;
}): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const absoluteExpiry = new Date(now + SESSION_ABSOLUTE_MS);

  await sql`
    INSERT INTO sessions (
      id, token_hash, account_id, parent_id, family_id, role,
      device_label, ip_hash, approx_location, user_agent, absolute_expires_at
    ) VALUES (
      ${newId('ses')}, ${hashToken(token)}, ${input.accountId}, ${input.parentId},
      ${input.familyId}, ${input.role}, ${input.deviceLabel}, ${input.ipHash},
      ${input.approxLocation}, ${input.userAgent}, ${absoluteExpiry.toISOString()}
    )
  `;

  return {
    token,
    maxAgeMs: SESSION_ABSOLUTE_MS,
    session: {
      accountId: input.accountId,
      parentId: input.parentId,
      familyId: input.familyId,
      role: input.role,
      issuedAt: now,
      expiresAt: now + SESSION_IDLE_MS,
      deviceLabel: input.deviceLabel,
    },
  };
}

/**
 * Resolve a cookie value to a session, sliding the idle window.
 *
 * Returns null for every failure mode — unknown token, revoked, idle-expired,
 * absolutely expired — so the caller cannot accidentally treat "expired" as a
 * different kind of signed-in.
 */
export interface ResolvedSession {
  session: Session;
  /** Row id of the `sessions` record this request authenticated against. */
  sessionRowId: string;
}

export async function resolveSession(token: string | null): Promise<ResolvedSession | null> {
  if (!token) return null;

  const rows = (await sql`
    SELECT id, account_id, parent_id, family_id, role, device_label,
           issued_at, last_seen_at, absolute_expires_at
      FROM sessions
     WHERE token_hash = ${hashToken(token)}
       AND revoked_at IS NULL
     LIMIT 1
  `) as unknown as SessionRow[];

  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const lastSeen = new Date(row.last_seen_at).getTime();
  const absolute = new Date(row.absolute_expires_at).getTime();

  if (now > absolute || now - lastSeen > SESSION_IDLE_MS) {
    await revokeSessionById(row.id);
    return null;
  }

  // Slide the idle window. Written unconditionally rather than debounced: a
  // write per request is cheap next to getting "signed out mid-form" wrong.
  await sql`UPDATE sessions SET last_seen_at = now() WHERE id = ${row.id}`;

  return {
    sessionRowId: row.id,
    session: {
      accountId: row.account_id,
      parentId: row.parent_id,
      familyId: row.family_id,
      role: row.role,
      issuedAt: new Date(row.issued_at).getTime(),
      expiresAt: now + SESSION_IDLE_MS,
      deviceLabel: row.device_label,
    },
  };
}

export async function revokeSession(token: string | null): Promise<void> {
  if (!token) return;
  await sql`UPDATE sessions SET revoked_at = now() WHERE token_hash = ${hashToken(token)}`;
}

export async function revokeSessionById(id: string): Promise<void> {
  await sql`UPDATE sessions SET revoked_at = now() WHERE id = ${id}`;
}

/**
 * Attach a family to every live session for an account.
 *
 * Called when a parent creates their family: their existing cookie should start
 * working for family-scoped routes without forcing a re-login.
 */
export async function bindFamilyToSessions(accountId: string, familyId: string): Promise<void> {
  await sql`
    UPDATE sessions SET family_id = ${familyId}
     WHERE account_id = ${accountId} AND revoked_at IS NULL
  `;
}

/**
 * Invalidate every session for an account except optionally one.
 *
 * Used on password change, on 2FA toggle, and when a moderator suspends an
 * account — a suspended parent must stop being able to act immediately, not at
 * the end of their idle window.
 */
export async function revokeAllForAccount(accountId: string, exceptToken?: string): Promise<void> {
  if (exceptToken) {
    await sql`
      UPDATE sessions SET revoked_at = now()
       WHERE account_id = ${accountId} AND revoked_at IS NULL
         AND token_hash <> ${hashToken(exceptToken)}
    `;
    return;
  }
  await sql`UPDATE sessions SET revoked_at = now() WHERE account_id = ${accountId} AND revoked_at IS NULL`;
}

/** Salted, truncated client-IP hash. Enough to distinguish devices, not to locate one. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).update(pepper).digest('hex').slice(0, 32);
}

/** Constant-time compare for short secrets (verification codes). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim()).update(pepper).digest('hex');
}
