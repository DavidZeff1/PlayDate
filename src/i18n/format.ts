import { useMemo } from 'react';
import { useI18n } from './index';
import type { TFunc, TKey } from './types';
import { joinList } from './render';
import type {
  AgeDisclosureView,
  AvailabilityView,
  ChildProjection,
  LocationView,
  TrustSignal,
  VerificationStatus,
} from '../domain/types';
import type { ValidationError } from '../domain/validation';
import { verificationLabelKey, verificationDescKey } from '../domain/trust/signals';

/**
 * The formatting layer.
 *
 * `domain/` produces structured views — a `LocationView`, an `AgeDisclosureView`, a
 * `ValidationError` carrying a key. This is where they become sentences, in whichever
 * language the reader has chosen. Keeping it in one hook means the same data is phrased
 * identically wherever it appears.
 */
export interface Formatters {
  /** "Noa" / "Child 1" / "ילד 1" — honours the parent's name-disclosure choice. */
  childName: (name: ChildProjection['displayName']) => string;
  /** "8 years old" / "7–9 years old" / "בן/בת 8". */
  ageLabel: (view: AgeDisclosureView) => string;
  /** "Jerusalem area" / "Rehavia, Jerusalem area" / "About 2–4 km away". */
  locationLabel: (view: LocationView) => string;
  /** "Weekend afternoons" / "בסופי שבוע, אחר הצהריים". */
  availabilityLabel: (view: AvailabilityView) => string;
  /** The detail line under a trust signal, e.g. "Member since March 2024". */
  trustDetail: (signal: TrustSignal) => string | undefined;
  /** A validation error's message. */
  errorText: (err: ValidationError | undefined) => string | undefined;
  /** Verification badge label and description. */
  verificationLabel: (status: VerificationStatus) => string;
  verificationDesc: (status: VerificationStatus) => string;
  /** Relative time — "3 hours ago", "לפני 3 שעות". */
  timeAgo: (iso: string) => string;
}

export function useFormat(): Formatters {
  const { t, locale, d } = useI18n();

  return useMemo(() => build(t, locale, d), [t, locale, d]);
}

function build(
  t: TFunc,
  locale: string,
  d: (v: string | Date, o?: Intl.DateTimeFormatOptions) => string,
): Formatters {
  const childName: Formatters['childName'] = (name) =>
    typeof name === 'string' ? name : t('common.childN', { n: name.placeholderIndex });

  const ageLabel: Formatters['ageLabel'] = (view) =>
    view.kind === 'exact'
      ? t('common.yearsOld', { n: view.age })
      : t('common.ageRange', { from: view.from, to: view.to });

  const locationLabel: Formatters['locationLabel'] = (view) => {
    switch (view.kind) {
      case 'hidden':
        return t('ed.locNotShared');
      case 'area':
        return view.area;
      case 'neighborhood':
        // Hebrew and English both read narrow-to-broad here, so the join is shared.
        return `${view.neighborhood}, ${view.area}`;
      case 'distance':
        return t('dist.aboutAway', { band: t(view.bandKey as TKey) });
    }
  };

  const availabilityLabel: Formatters['availabilityLabel'] = (view) => {
    if (view.scope === 'none' || view.blocks.length === 0) return t('avail.none');
    const blocks = joinList(
      view.blocks.map((b) => t(`blockPlural.${b}` as TKey)),
      locale,
    );
    const key: TKey =
      view.scope === 'weekend'
        ? 'avail.weekend'
        : view.scope === 'weekday'
          ? 'avail.weekday'
          : 'avail.mostDays';
    return t(key, { blocks });
  };

  const trustDetail: Formatters['trustDetail'] = (signal) => {
    if (!signal.detailKey) return undefined;
    // "Member since March 2024" needs a month name in the reader's language and
    // calendar, so the date is formatted here rather than baked in upstream.
    if (signal.detailDate) {
      return t(signal.detailKey as TKey, {
        month: d(signal.detailDate, { month: 'long', year: 'numeric' }),
      });
    }
    return t(signal.detailKey as TKey, signal.detailVars);
  };

  const errorText: Formatters['errorText'] = (err) => {
    if (!err) return undefined;
    // A composed error like "Family name is required" nests a label key inside its
    // values; resolve that before interpolating.
    const vars = err.vars
      ? Object.fromEntries(
          Object.entries(err.vars).map(([k, v]) =>
            k === 'label' && typeof v === 'string' ? [k, t(v as TKey)] : [k, v],
          ),
        )
      : undefined;
    return t(err.key, vars);
  };

  const timeAgo: Formatters['timeAgo'] = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('common.justNow');
    if (mins < 60) return t('common.minAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours === 1 ? t('common.hourAgo', { n: 1 }) : t('common.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t('common.dayAgo', { n: 1 });
    if (days < 30) return t('common.daysAgo', { n: days });
    return d(iso, { day: 'numeric', month: 'short' });
  };

  return {
    childName,
    ageLabel,
    locationLabel,
    availabilityLabel,
    trustDetail,
    errorText,
    verificationLabel: (s) => t(verificationLabelKey(s)),
    verificationDesc: (s) => t(verificationDescKey(s)),
    timeAgo,
  };
}
