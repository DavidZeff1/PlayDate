import type { IncomingMessage, ServerResponse } from 'node:http';
import { BadRequestError } from './errors';

/**
 * Request body parsing and JSON responses.
 *
 * The body is read with a hard byte cap. Without one, an unauthenticated
 * request can pin a function's memory for its full duration at no cost to the
 * sender — the cheapest denial-of-service there is against a serverless
 * runtime that bills by the gigabyte-second.
 */

const MAX_BODY_BYTES = 128 * 1024;

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new BadRequestError('Request body is too large.', undefined, 'body_too_large');
    }
    chunks.push(buf);
  }

  if (total === 0) return {};

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed: unknown = JSON.parse(text);
    // Reject arrays and primitives at the boundary: every endpoint takes an
    // object, and accepting anything else pushes shape-checking into handlers.
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('Request body must be a JSON object.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('Request body is not valid JSON.');
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body ?? null);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // API responses are per-account and must never sit in a shared cache.
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(payload);
}

export function sendNoContent(res: ServerResponse, headers: Record<string, string> = {}): void {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store, private');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end();
}
