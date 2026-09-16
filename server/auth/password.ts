import { argon2id, argon2Verify } from 'hash-wasm';

/**
 * Password hashing.
 *
 * Argon2id via WASM rather than a native binding: Vercel's build step does not
 * reliably produce native artefacts for every runtime target, and a hashing
 * library that fails to compile at deploy time is a hashing library that gets
 * swapped for something weaker under deadline pressure.
 *
 * Parameters follow OWASP's Argon2id guidance (19 MiB, t=2, p=1). They are
 * encoded in the output string, so raising them later does not invalidate
 * existing hashes — `needsRehash()` tells you which ones to upgrade on next
 * successful sign-in.
 */

const MEMORY_KIB = 19456; // 19 MiB
const ITERATIONS = 2;
const PARALLELISM = 1;

export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: crypto.getRandomValues(new Uint8Array(16)),
    memorySize: MEMORY_KIB,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    hashLength: 32,
    outputType: 'encoded',
  });
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed stored hash, so a corrupt
 * row fails closed as "wrong password" instead of 500-ing and telling an
 * attacker they found something interesting.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: storedHash });
  } catch {
    return false;
  }
}

/** True when a stored hash was produced with weaker parameters than current. */
export function needsRehash(storedHash: string): boolean {
  const m = /\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
  if (!m) return true;
  return Number(m[1]) < MEMORY_KIB || Number(m[2]) < ITERATIONS || Number(m[3]) < PARALLELISM;
}

/**
 * Constant-ish work for a sign-in against an email that does not exist.
 *
 * Without this, "no such account" returns in microseconds and "wrong password"
 * takes ~50ms, which is a timing oracle for account enumeration — on a platform
 * where confirming somebody is a parent here is itself sensitive.
 */
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomUUID());

export async function burnPasswordTime(): Promise<void> {
  await verifyPassword('not-a-real-password', await DUMMY_HASH_PROMISE);
}
