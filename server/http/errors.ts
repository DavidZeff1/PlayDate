/**
 * HTTP error surface.
 *
 * Every error that reaches the client is one of these, serialised as
 *
 *   { "error": { "code": "...", "message": "...", "field"?, "retryAfterSeconds"? } }
 *
 * `code` is the contract; `message` is a sentence for a parent. The client maps
 * `code` back onto the error classes the UI already catches (AuthorizationError,
 * RateLimitError, ValidationError, NotFoundError), so no page changes.
 *
 * Anything NOT on this list becomes a generic 500 with no detail. An unexpected
 * exception must never leak a stack trace, a SQL fragment or a column name to
 * the browser — on this platform an error message is an information-disclosure
 * channel like any other.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { field?: string; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.field = extra?.field;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, field?: string, code = 'validation') {
    super(400, code, message, { field });
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'You need to be signed in.', code = 'unauthenticated') {
    super(401, code, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string, code = 'forbidden') {
    super(403, code, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found.', code = 'not_found') {
    super(404, code, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, code = 'conflict') {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message: string, retryAfterSeconds: number, code: string) {
    super(429, code, message, { retryAfterSeconds });
  }
}

export class NotImplementedError extends HttpError {
  constructor(operation: string) {
    super(
      501,
      'not_implemented',
      `${operation} is not implemented on the server yet. See docs/BACKEND.md for the ` +
        `remaining endpoints and the order they are being ported in.`,
    );
  }
}

export interface WireError {
  error: { code: string; message: string; field?: string; retryAfterSeconds?: number };
}

/**
 * Map any thrown value onto a wire error.
 *
 * Domain errors from `src/services/security/guards.ts` are recognised by name
 * rather than by `instanceof`: the guard module is shared with the browser
 * bundle, and matching on name avoids a dual-realm identity problem if the
 * module is ever loaded twice.
 */
export function toWireError(error: unknown): { status: number; body: WireError; retryAfter?: number } {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      retryAfter: error.retryAfterSeconds,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.field ? { field: error.field } : {}),
          ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        },
      },
    };
  }

  if (error && typeof error === 'object' && 'name' in error) {
    const named = error as { name: string; message?: string; code?: string; retryAfterSeconds?: number };

    if (named.name === 'AuthorizationError') {
      const code = named.code ?? 'forbidden';
      const status = code === 'unauthenticated' || code === 'session_expired' ? 401 : 403;
      return {
        status,
        body: { error: { code, message: named.message ?? 'Not permitted.' } },
      };
    }

    if (named.name === 'RateLimitError') {
      const retryAfter = named.retryAfterSeconds ?? 60;
      return {
        status: 429,
        retryAfter,
        body: {
          error: {
            code: 'rate_limited',
            message: named.message ?? 'Too many requests.',
            retryAfterSeconds: retryAfter,
          },
        },
      };
    }
  }

  return {
    status: 500,
    body: { error: { code: 'internal', message: 'Something went wrong. Please try again.' } },
  };
}
