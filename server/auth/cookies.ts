import { env } from '../env';

/**
 * Session cookie handling.
 *
 * The prototype kept sessions in localStorage, which is readable by any script
 * on the origin — one XSS and every session is exfiltrable. These cookies are
 * HttpOnly, so JavaScript cannot read them at all, which means an XSS can act
 * as the user but cannot walk away with a token that keeps working afterwards.
 */

export const SESSION_COOKIE = '__Host-pd_session';

/** 30 minutes of inactivity, matching the prototype's SESSION_IDLE_MS. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Hard ceiling regardless of activity. A stolen cookie expires on its own. */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `__Host-` prefix: the browser refuses the cookie unless it is Secure, has
 * Path=/ and has NO Domain attribute. That last part is what stops a
 * compromised sibling subdomain from setting a session cookie for us.
 *
 * SameSite=Lax rather than Strict: Strict would drop the cookie on any
 * inbound link, so a parent following an email link to a request would land
 * signed out. Lax plus the required custom header in `csrf.ts` covers the
 * cross-site write case that Strict was protecting.
 */
export function sessionCookie(token: string, maxAgeMs: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  // Secure is mandatory for __Host-. Localhost over plain HTTP is the one case
  // browsers exempt, and dropping the prefix there keeps local dev working.
  if (env.appOrigin.startsWith('https://')) parts.push('Secure');
  return parts.join('; ');
}

export function clearedSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (env.appOrigin.startsWith('https://')) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
