import type { en } from './dict.en';

/**
 * Pure i18n types, split out of `index.tsx` so the domain layer can depend on them
 * without pulling in React.
 *
 * This is what lets `domain/` stop returning English. A matching reason is a key plus
 * interpolation values; the UI is the only layer that turns that into a sentence. A
 * domain module that hardcoded "4 shared interests" would be untranslatable, and
 * — more to the point — would be making a presentation decision it has no business
 * making.
 */
export type TKey = keyof typeof en;
export type TVars = Record<string, string | number>;
export type TFunc = (key: TKey, vars?: TVars) => string;
