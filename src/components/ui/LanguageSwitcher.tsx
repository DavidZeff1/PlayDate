import { useI18n, LOCALE_META, type Locale } from '../../i18n';

/**
 * Language switcher.
 *
 * Each option is labelled in its own language ("English", "עברית") rather than in the
 * current one — the person who needs this control is by definition someone who may not
 * be reading the current language comfortably.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  const options: Locale[] = ['en', 'he'];

  return (
    <div
      className="segmented"
      role="group"
      aria-label={t('lang.switch')}
      style={compact ? { padding: 2 } : undefined}
    >
      {options.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          // Each label renders in its own script direction so "עברית" is not
          // reordered by the surrounding text's bidi context.
          lang={LOCALE_META[l].htmlLang}
          dir={LOCALE_META[l].dir}
          style={compact ? { padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)' } : undefined}
        >
          {LOCALE_META[l].label}
        </button>
      ))}
    </div>
  );
}
