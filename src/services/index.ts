import type { PlayDateApi } from './api';
import { MockPlayDateApi } from './mock/mockApi';
import { HttpPlayDateApi } from './http/httpApi';

/**
 * The single place the application binds to an implementation.
 *
 * `VITE_API_URL` selects the real backend. Unset — which is the case for a
 * local `npm run dev` with no database — the app falls back to the browser-local
 * mock, so the prototype keeps working without a Postgres instance.
 *
 * Nothing above this line imports from `mock/` or `http/`, so swapping the two
 * changes no page, component or hook.
 *
 * On Vercel, set VITE_API_URL to "/api" for the deployed environments. Leaving
 * it unset there would ship the localStorage prototype to production, which is
 * the one failure mode worth being loud about — see docs/BACKEND.md.
 */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const api: PlayDateApi = apiUrl ? new HttpPlayDateApi(apiUrl) : new MockPlayDateApi();

/** True when the app is running against the browser-local prototype store. */
export const isPrototypeBackend = !apiUrl;

export type { PlayDateApi } from './api';
export * from './api';
export { RateLimitError } from './security/rateLimit';
export { AuthorizationError } from './security/guards';
export { NotFoundError, ValidationError } from './errors';
