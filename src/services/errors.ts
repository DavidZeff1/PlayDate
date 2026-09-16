/**
 * Errors that cross the API boundary.
 *
 * Extracted from `mock/mockApi.ts` so the HTTP client can throw the same
 * classes the UI already catches without importing the mock — which would drag
 * the entire localStorage store into the bundle of an app talking to a real
 * server.
 */

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
