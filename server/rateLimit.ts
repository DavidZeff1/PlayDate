import { RATE_LIMITS, type RateLimitKey } from '../src/services/security/rateLimit';
import { sql } from './db/client';
import { TooManyRequestsError } from './http/errors';

/**
 * Server-side rate limiting.
 *
 * Reuses `RATE_LIMITS` from the shared module so the browser and the server
 * agree on the numbers — the client copy keeps the UI honest about what is
 * about to be refused, and this copy is the one that actually enforces.
 *
 * Buckets live in Postgres so they are shared across function invocations. A
 * per-process limiter in a serverless runtime limits nothing: every cold start
 * is a fresh, full bucket, so an attacker rotating connections gets unlimited
 * allowance.
 *
 * At scale this moves to Upstash Redis with identical semantics — see the
 * commented variables in .env.example. Postgres is the right call while the
 * scaffold should need one service rather than two.
 */

export type { RateLimitKey };

/**
 * Consume one token, or throw.
 *
 * The whole refill-and-decrement runs inside a single `INSERT … ON CONFLICT DO
 * UPDATE`, so it holds a row lock for its duration and concurrent requests
 * cannot both read the same pre-decrement value. Tokens are allowed to go
 * negative (floored at -capacity) — that is what makes "how long until you may
 * retry" computable rather than guessed.
 */
export async function consume(actorId: string, key: RateLimitKey): Promise<void> {
  const rule = RATE_LIMITS[key];
  const bucketKey = `${actorId}:${key}`;

  const rows = (await sql`
    INSERT INTO rate_limit_buckets (bucket_key, tokens, updated_at)
         VALUES (${bucketKey}, ${rule.capacity - 1}, now())
    ON CONFLICT (bucket_key) DO UPDATE
           SET tokens = GREATEST(
                          ${-rule.capacity}::float8,
                          LEAST(
                            ${rule.capacity}::float8,
                            rate_limit_buckets.tokens
                              + EXTRACT(EPOCH FROM (now() - rate_limit_buckets.updated_at)) / 60.0
                                * ${rule.refillPerMinute}::float8
                          ) - 1
                        ),
               updated_at = now()
      RETURNING tokens
  `) as unknown as Array<{ tokens: number }>;

  const tokens = Number(rows[0]?.tokens ?? 0);
  if (tokens < 0) {
    const secondsToOne = ((1 - tokens) / rule.refillPerMinute) * 60;
    throw new TooManyRequestsError(rule.message, Math.ceil(secondsToOne), `rate_limited.${key}`);
  }
}

/**
 * Housekeeping: drop buckets that have fully refilled and cannot affect a
 * decision. Call from a Vercel Cron job; without it the table grows one row per
 * (actor, action) pair forever.
 */
export async function pruneStaleBuckets(): Promise<number> {
  const rows = (await sql`
    DELETE FROM rate_limit_buckets
     WHERE updated_at < now() - interval '24 hours'
     RETURNING 1
  `) as unknown as unknown[];
  return rows.length;
}
