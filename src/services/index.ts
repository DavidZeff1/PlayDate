import type { PlayDateApi } from './api';
import { MockPlayDateApi } from './mock/mockApi';

/**
 * The single place the application binds to an implementation.
 *
 * Replacing the prototype's mock backend with a real one is this file plus a new class
 * implementing `PlayDateApi` — no page, component or hook changes, because nothing above
 * this line imports from `mock/`.
 *
 *   const api: PlayDateApi = import.meta.env.VITE_API_URL
 *     ? new HttpPlayDateApi(import.meta.env.VITE_API_URL)
 *     : new MockPlayDateApi();
 */
export const api: PlayDateApi = new MockPlayDateApi();

export type { PlayDateApi } from './api';
export * from './api';
export { RateLimitError } from './security/rateLimit';
export { AuthorizationError } from './security/guards';
export { NotFoundError, ValidationError } from './mock/mockApi';
