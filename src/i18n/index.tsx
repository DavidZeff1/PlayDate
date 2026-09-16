import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en } from './dict.en';
import { he } from './dict.he';
import type { TKey, TVars } from './types';

/**
 * Internationalisation.
 *
 * Two things a Hebrew option actually requires, and only one of them is translation:
 *
 *  1. **Strings.** A flat, dotted-key dictionary. `dict.en.ts` is the source of truth;
 *     `TKey` is derived from it, so `dict.he.ts` is typed as `Record<TKey, string>` and
 *     the build fails if a key is missing or misspelled. There is no silent fallback to
 *     a raw key in a shipped build — TypeScript catches it first.
 *
 *  2. **Direction.** Hebrew is right-to-left. `dir` is set on `<html>`, and the stylesheet
 *     uses CSS logical properties (`margin-inline-start`, `inset-inline-start`,
 *     `border-inline-end`) so the entire layout mirrors without a parallel RTL stylesheet.
 *     The handful of things logical properties cannot express — transforms, background
 *     positions, directional icons — are handled explicitly in `rtl.css` and by the
 *     `DirectionalIcon` helper.
 *
 * Deliberately not using an i18n library: the whole mechanism is ~80 lines, the type
 * safety is better than most libraries give you, and a prototype should not take a
 * dependency it can read in one sitting.
 */

export type Locale = 'en' | 'he';
export type Direction = 'ltr' | 'rtl';
export type { TKey, TVars, TFunc } from './types';

const DICTS: Record<Locale, Record<TKey, string>> = { en, he };

export const LOCALE_META: Record<
  Locale,
  { label: string; englishLabel: string; dir: Direction; htmlLang: string }
> = {
  en: { label: 'English', englishLabel: 'English', dir: 'ltr', htmlLang: 'en' },
  he: { label: 'עברית', englishLabel: 'Hebrew', dir: 'rtl', htmlLang: 'he' },
};

const STORAGE_KEY = 'playdate.locale.v1';

export interface I18n {
  locale: Locale;
  dir: Direction;
  isRtl: boolean;
  setLocale: (l: Locale) => void;
  /** Translate a key, interpolating `{name}` placeholders. */
  t: (key: TKey, vars?: TVars) => string;
  /** Locale-aware number formatting. */
  n: (value: number) => string;
  /** Locale-aware date/time formatting. */
  d: (value: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for the common case — `const t = useT()`. */
export function useT(): I18n['t'] {
  return useI18n().t;
}

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'he') return stored;
  } catch {
    /* storage may be unavailable — fall through to detection */
  }
  try {
    // Respect the browser's preference on a first visit. A Hebrew-speaking parent
    // should not have to find a language switcher to read the landing page.
    if (typeof navigator !== 'undefined') {
      for (const lang of navigator.languages ?? [navigator.language]) {
        if (lang?.toLowerCase().startsWith('he') || lang?.toLowerCase().startsWith('iw')) {
          return 'he';
        }
      }
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const dir = LOCALE_META[locale].dir;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', LOCALE_META[locale].htmlLang);
    root.setAttribute('dir', dir);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* non-fatal: the choice just will not persist */
    }
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const value = useMemo<I18n>(() => {
    const dict = DICTS[locale];
    const intlLocale = locale === 'he' ? 'he-IL' : 'en-GB';

    const n = (v: number) => new Intl.NumberFormat(intlLocale).format(v);

    const t = (key: TKey, vars?: TVars) => {
      // `?? en[key]` is belt-and-braces: TKey makes a missing Hebrew key a build
      // error, but a hand-edited dictionary shipped without a typecheck should
      // degrade to English rather than to a raw key on screen.
      const template = dict[key] ?? en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const v = vars[name];
        if (v === undefined) return match;
        return typeof v === 'number' ? n(v) : v;
      });
    };

    const d = (value: string | Date, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(intlLocale, opts).format(
        typeof value === 'string' ? new Date(value) : value,
      );

    return { locale, dir, isRtl: dir === 'rtl', setLocale, t, n, d };
  }, [locale, dir, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
