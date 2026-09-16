import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildContext } from '../server/http/context';
import { assertSameOriginWrite } from '../server/auth/csrf';
import { readJsonBody, sendJson } from '../server/http/json';
import { toWireError } from '../server/http/errors';
import { resolveRoute } from '../server/http/router';

/**
 * The single API function.
 *
 * One catch-all rather than a file per endpoint, for three reasons: Vercel's
 * Hobby plan caps serverless functions at twelve and there are fifty-eight
 * operations; one function means one cold start rather than fifty-eight; and
 * the security sequence (CSRF → body → context → route) lives in exactly one
 * place where it can be read end to end.
 *
 * Nothing here knows what any endpoint does. It parses, authenticates, hands
 * off, and makes sure that whatever happens the client gets a clean JSON error
 * rather than a stack trace.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const operation = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');

  // Liveness only. Says nothing about the database or the caller — a health
  // endpoint that reports which dependencies are down is a reconnaissance
  // endpoint.
  if (operation === 'health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (method !== 'POST') {
      sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Use POST.' } }, { Allow: 'POST' });
      return;
    }

    assertSameOriginWrite(method, req.headers as Record<string, string | string[] | undefined>);

    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const ctx = await buildContext({ req, res, method, path: operation, body, query: url.searchParams });

    const route = resolveRoute(operation);
    const result = await route(ctx);

    sendJson(res, 200, result ?? null);
  } catch (error) {
    const { status, body, retryAfter } = toWireError(error);

    // Unexpected failures are logged server-side in full and returned to the
    // client as a bare 500. The two audiences need different amounts of detail.
    if (status >= 500) {
      console.error(`[api] ${operation} failed`, error);
    }

    sendJson(res, status, body, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
  }
}
