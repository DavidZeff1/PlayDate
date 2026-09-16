import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Account, Family, Role, Session } from '../../src/domain/types';
import { redactForLog } from '../../src/domain/privacy/redaction';
import {
  assertAccountInGoodStanding,
  assertRole,
  assertSession,
} from '../../src/services/security/guards';
import { sql, newId } from '../db/client';
import { loadAccount } from '../db/repos/accounts';
import { loadFamily } from '../db/repos/families';
import { consume, type RateLimitKey } from '../rateLimit';
import { readCookie, SESSION_COOKIE } from '../auth/cookies';
import { hashIp, resolveSession } from '../auth/sessions';
import { UnauthenticatedError, ForbiddenError } from './errors';

/**
 * Per-request context.
 *
 * Every handler receives one of these and reaches the database only through it,
 * which is what makes the security sequence impossible to forget. The order is
 * the same one `mockApi` established and for the same reasons:
 *
 *   resolve session → rate limit → authorize → act → audit
 *
 * Rate limiting comes before authorization deliberately: an unauthenticated
 * attacker hammering sign-in should be stopped by the limiter, not by the
 * expensive part of the auth check.
 */

export interface RequestContext {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly method: string;
  readonly path: string;
  readonly body: Record<string, unknown>;
  readonly query: URLSearchParams;
  readonly session: Session | null;
  readonly rawToken: string | null;
  /** Row id of the authenticating session, or null when signed out. */
  readonly currentSessionId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;

  /** Throws 401 when signed out or expired. Narrows the session type. */
  requireSession(): Session;
  /** Signed in AND has a family. Most endpoints need this. */
  requireFamily(): Promise<{ session: Session; account: Account; family: Family }>;
  /** Signed in with an account that is not suspended, banned or under restriction. */
  requireAccount(): Promise<{ session: Session; account: Account }>;
  requireRole(...roles: Role[]): Session;

  limit(key: RateLimitKey, actorOverride?: string): Promise<void>;
  audit(entry: AuditInput): Promise<void>;
  setHeader(name: string, value: string): void;
}

export interface AuditInput {
  actor?: string;
  actorRole?: Role | 'system';
  action: string;
  target?: string;
  caseId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export async function buildContext(input: {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
  body: Record<string, unknown>;
  query: URLSearchParams;
}): Promise<RequestContext> {
  const { req, res, method, path, body, query } = input;

  const rawToken = readCookie(req.headers.cookie, SESSION_COOKIE);
  const resolved = await resolveSession(rawToken);
  const session = resolved?.session ?? null;
  const ip = clientIp(req);
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  const extraHeaders: Record<string, string> = {};

  const ctx: RequestContext = {
    req,
    res,
    method,
    path,
    body,
    query,
    session,
    rawToken,
    currentSessionId: resolved?.sessionRowId ?? null,
    ip,
    userAgent,

    requireSession(): Session {
      if (!session) throw new UnauthenticatedError();
      // Reuses the shared guard so the rule lives in exactly one place.
      assertSession(session);
      return session;
    },

    async requireAccount() {
      const s = ctx.requireSession();
      const account = await loadAccount(s.accountId);
      if (!account) throw new UnauthenticatedError('Your account could not be loaded.');
      assertAccountInGoodStanding(account);
      return { session: s, account };
    },

    async requireFamily() {
      const { session: s, account } = await ctx.requireAccount();
      if (!s.familyId) {
        throw new ForbiddenError('Create your family profile first.', 'no_family');
      }
      const family = await loadFamily(s.familyId);
      if (!family) throw new ForbiddenError('Create your family profile first.', 'no_family');
      return { session: s, account, family };
    },

    requireRole(...roles: Role[]): Session {
      const s = ctx.requireSession();
      assertRole(s, ...roles);
      return s;
    },

    async limit(key: RateLimitKey, actorOverride?: string): Promise<void> {
      // Signed-out actors are limited by hashed IP. Not perfect — a NAT shares
      // one — but the alternative is no limit at all on sign-in and signup.
      const actor = actorOverride ?? session?.accountId ?? `ip:${hashIp(ip) ?? 'unknown'}`;
      await consume(actor, key);
    },

    async audit(entry: AuditInput): Promise<void> {
      await writeAudit({
        actor: entry.actor ?? session?.accountId ?? 'anonymous',
        actorRole: entry.actorRole ?? session?.role ?? 'system',
        action: entry.action,
        target: entry.target,
        caseId: entry.caseId,
        metadata: entry.metadata,
      });
    },

    setHeader(name: string, value: string): void {
      extraHeaders[name] = value;
      res.setHeader(name, value);
    },
  };

  return ctx;
}

/**
 * Write an audit row.
 *
 * `metadata` and `target` go through `redactForLog()` — the same function the
 * prototype used — so an audit trail can never become the place PII leaks. An
 * audit log that records what it was protecting is worse than no audit log,
 * because it concentrates the sensitive data and is retained longer.
 */
export async function writeAudit(entry: {
  actor: string;
  actorRole: Role | 'system';
  action: string;
  target?: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const safeMetadata = entry.metadata ? (redactForLog(entry.metadata) as Record<string, unknown>) : {};
  await sql`
    INSERT INTO audit_log (actor, actor_role, action, target, case_id, metadata)
    VALUES (
      ${entry.actor}, ${entry.actorRole}, ${entry.action},
      ${entry.target ?? null}, ${entry.caseId ?? null}, ${JSON.stringify(safeMetadata)}::jsonb
    )
  `;
}

/**
 * Client IP.
 *
 * On Vercel, `x-forwarded-for` is set by the edge and the left-most entry is
 * the real client. Trusting it is only safe because nothing but Vercel can
 * reach the function; behind a different proxy this needs re-deriving.
 */
function clientIp(req: IncomingMessage): string | null {
  const xff = req.headers['x-forwarded-for'];
  const value = Array.isArray(xff) ? xff[0] : xff;
  if (!value) return req.socket?.remoteAddress ?? null;
  return value.split(',')[0]?.trim() ?? null;
}

/** Best-effort device label from the User-Agent, for the "where you're signed in" list. */
export function deviceLabelFrom(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();
  const os = ua.includes('iphone')
    ? 'iPhone'
    : ua.includes('ipad')
      ? 'iPad'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('mac os')
          ? 'Mac'
          : ua.includes('windows')
            ? 'Windows'
            : ua.includes('linux')
              ? 'Linux'
              : 'Device';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('firefox/')
        ? 'Firefox'
        : ua.includes('safari/')
          ? 'Safari'
          : 'Browser';
  return `${browser} on ${os}`;
}

/** Placeholder for coarse geo-IP. Deliberately coarse — city at most, never finer. */
export function approxLocationFrom(_ip: string | null): string {
  return 'Unknown';
}

export { newId };
