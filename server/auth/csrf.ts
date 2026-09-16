import { env } from '../env';
import { ForbiddenError } from '../http/errors';

/**
 * CSRF defence for state-changing requests.
 *
 * Two independent checks, because each covers a gap in the other:
 *
 *  1. **Required custom header.** A cross-origin form POST cannot set an
 *     arbitrary header, and a cross-origin fetch that tries is stopped by the
 *     preflight (we send no permissive CORS headers, so the preflight fails).
 *     This is what makes SameSite=Lax safe for mutations.
 *
 *  2. **Origin check.** Belt and braces for browsers or proxies that mangle
 *     the header, and it catches a same-site-but-wrong-subdomain caller.
 *
 * Deliberately not a synchroniser token: that needs server-side state or a
 * second cookie, and buys nothing over the above for a same-origin JSON API.
 */

export const CSRF_HEADER = 'x-playdate-request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertSameOriginWrite(
  method: string,
  headers: Record<string, string | string[] | undefined>,
): void {
  if (SAFE_METHODS.has(method.toUpperCase())) return;

  const header = headers[CSRF_HEADER];
  if (!header) {
    throw new ForbiddenError(
      'This request is missing its client header.',
      'csrf_header_missing',
    );
  }

  const origin = first(headers['origin']);
  if (origin && !isAllowedOrigin(origin)) {
    throw new ForbiddenError('Cross-origin write rejected.', 'csrf_bad_origin');
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedOrigin(origin: string): boolean {
  if (origin === env.appOrigin) return true;
  // Vercel preview deployments get a generated hostname per commit. Allowing
  // the project's own preview domains keeps previews usable without opening
  // the API to arbitrary origins.
  if (!env.isProduction && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  if (!env.isProduction && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}
