import { heCommon } from './he.common';
import { hePages } from './he.pages';
import type { en } from './dict.en';

/**
 * The full Hebrew dictionary.
 *
 * Typed against the English one, so a key added to `en` and forgotten here fails the
 * build rather than falling back silently at runtime.
 */
export const he: Record<keyof typeof en, string> = { ...heCommon, ...hePages };
