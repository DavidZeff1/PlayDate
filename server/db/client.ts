import { neon, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from '../env';

/**
 * Database access.
 *
 * Uses Neon's HTTP driver rather than a TCP pool. In a serverless runtime every
 * invocation is a fresh process, so a classic `pg.Pool` opens a connection per
 * request and exhausts the server's connection limit under trivial load. The
 * HTTP driver has no persistent connection to exhaust.
 *
 * The tradeoff: each `sql` call is its own round trip and its own implicit
 * transaction. Anything that must be atomic goes through `transaction()`, which
 * uses the driver's batch mode.
 */

neonConfig.fetchConnectionCache = true;

export const sql: NeonQueryFunction<false, false> = neon(env.databaseUrl);

export type SqlFragment = ReturnType<typeof sql>;

/**
 * Run several statements as one transaction.
 *
 * Note the shape: you build an array of queries and hand them over, rather than
 * interleaving application logic with open statements. That is a constraint of
 * the HTTP driver, and a useful one — it makes long transactions that hold
 * locks while awaiting something unrelated impossible to write by accident.
 *
 * For read-then-conditionally-write flows, prefer a single statement with
 * `INSERT … ON CONFLICT` or a `WHERE` guard that encodes the precondition, so
 * the check and the write cannot interleave with another request.
 */
export async function transaction<T extends readonly unknown[]>(
  build: (q: typeof sql) => T,
): Promise<unknown[]> {
  const queries = build(sql);
  return sql.transaction(queries as never);
}

/** First row or null, for the common "find one" case. */
export function one<T>(rows: Record<string, unknown>[]): T | null {
  return (rows[0] as T | undefined) ?? null;
}

/** First row, or throw. Use where absence is a bug rather than a 404. */
export function exactlyOne<T>(rows: Record<string, unknown>[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Expected exactly one ${what}, got none`);
  return row as T;
}

/** Monotonic-ish, sortable, collision-resistant id with a readable prefix. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${time}${rand}`;
}
