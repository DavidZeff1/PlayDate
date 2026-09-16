import type { ReactNode } from 'react';
import type {
  ChildProjection,
  FamilyProjection,
  PlaydateStyle,
  TrustSignal,
  VerificationStatus,
} from '../../domain/types';
import { interestEmoji, interestLabel } from '../../domain/interests';
import {
  VERIFICATION_TONE,
  discoverySignals,
  signalDescriptionKey,
  signalLabelKey,
} from '../../domain/trust/signals';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import { Avatar, Badge, Stars } from '../ui';
import { IconCheck, IconClock, IconLock, IconMapPin, IconUsers } from '../ui/Icons';

/* ========================================================================== */
/* Verification badge                                                          */
/* ========================================================================== */

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const f = useFormat();
  const tone = VERIFICATION_TONE[status];
  return (
    <Badge tone={tone}>
      {status === 'verified' && <IconCheck size={11} />}
      {f.verificationLabel(status)}
    </Badge>
  );
}

/* ========================================================================== */
/* Trust signals                                                               */
/* ========================================================================== */

/**
 * Trust signals are listed as facts, never summed into a score.
 *
 * A parent reading "ID verified · Member since March 2024 · 11 playdates completed"
 * can form their own judgement. A single "Trust: 92" would ask them to defer to our
 * arithmetic — and would rank parents against each other like marketplace sellers,
 * which the brief explicitly warns against.
 */
export function TrustSignals({
  signals,
  compact = false,
}: {
  signals: TrustSignal[];
  compact?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const shown = compact ? discoverySignals(signals) : signals.filter((s) => s.satisfied);

  if (shown.length === 0) {
    return <span className="small muted">{t('trust.none')}</span>;
  }

  if (compact) {
    return (
      <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
        {shown.slice(0, 3).map((s) => (
          <span key={s.kind} className="badge badge-neutral" title={t(signalDescriptionKey(s.kind))}>
            <IconCheck size={10} />
            {f.trustDetail(s) ?? t(signalLabelKey(s.kind))}
          </span>
        ))}
      </div>
    );
  }

  return (
    <ul className="stack stack-2">
      {shown.map((s) => (
        <li key={s.kind} className="row row-3" style={{ alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
            <IconCheck size={14} />
          </span>
          <div>
            <div className="small strong">{f.trustDetail(s) ?? t(signalLabelKey(s.kind))}</div>
            <div className="tiny muted">{t(signalDescriptionKey(s.kind))}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* Interest tags                                                               */
/* ========================================================================== */

export function InterestTags({
  interestIds,
  sharedIds = [],
  limit,
}: {
  interestIds: string[];
  sharedIds?: string[];
  limit?: number;
}) {
  const t = useT();
  const shared = new Set(sharedIds);
  // Shared interests lead — they are the reason this family is on screen.
  const ordered = [...interestIds].sort((a, b) => Number(shared.has(b)) - Number(shared.has(a)));
  const shown = limit ? ordered.slice(0, limit) : ordered;
  const rest = ordered.length - shown.length;

  return (
    <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
      {shown.map((id) => (
        <span key={id} className={`interest-tag${shared.has(id) ? ' interest-tag-shared' : ''}`}>
          <span aria-hidden="true">{interestEmoji(id)}</span>
          {interestLabel(id, t)}
        </span>
      ))}
      {rest > 0 && <span className="interest-tag">{t('common.andMore', { n: rest })}</span>}
    </div>
  );
}

/* ========================================================================== */
/* Child summary                                                               */
/* ========================================================================== */

export function ChildSummary({
  child,
  sharedInterestIds = [],
  showInterests = true,
}: {
  child: ChildProjection;
  sharedInterestIds?: string[];
  showInterests?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const name = f.childName(child.displayName);

  return (
    <div className="stack stack-3">
      <div className="row row-3">
        <Avatar name={name} color={child.avatarColor} size="sm" />
        <div>
          <div className="strong" style={{ fontSize: 'var(--text-base)' }}>
            {name}
          </div>
          <div className="small muted">{f.ageLabel(child.ageView)}</div>
        </div>
        {!child.photoVisible && (
          <span
            className="tiny muted row row-2"
            style={{ marginInlineStart: 'auto' }}
            title={t('card.noPhotoTitle')}
          >
            <IconLock size={11} />
            {t('card.noPhoto')}
          </span>
        )}
      </div>

      {showInterests && child.interests.length > 0 && (
        <InterestTags
          interestIds={child.interests.map((i) => i.interestId)}
          sharedIds={sharedInterestIds}
          limit={6}
        />
      )}
    </div>
  );
}

/**
 * The detailed child view used inside a compatibility panel and on your own family
 * profile: interests with the child's own enthusiasm shown as stars.
 */
export function ChildInterestList({ child }: { child: ChildProjection }) {
  const t = useT();
  if (child.interests.length === 0) {
    return <p className="small muted">{t('compat.noInterestsYet')}</p>;
  }
  return (
    <ul className="stack stack-2">
      {[...child.interests]
        .sort((a, b) => b.enthusiasm - a.enthusiasm)
        .map((i) => (
          <li key={i.interestId} className="row row-between row-3">
            <span className="small row row-2">
              <span aria-hidden="true">{interestEmoji(i.interestId)}</span>
              {interestLabel(i.interestId, t)}
            </span>
            <Stars value={i.enthusiasm} size="readonly" label={interestLabel(i.interestId, t)} />
          </li>
        ))}
    </ul>
  );
}

/* ========================================================================== */
/* Family meta line                                                            */
/* ========================================================================== */

export function styleLabel(style: PlaydateStyle, t: ReturnType<typeof useT>): string {
  return t(`style.${style}` as never);
}

export function FamilyMeta({ family }: { family: FamilyProjection }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)' }}>
      <span className="row row-2">
        <IconMapPin size={13} />
        {f.locationLabel(family.location)}
      </span>
      <span className="row row-2">
        <IconUsers size={13} />
        {family.childCount} {family.childCount === 1 ? t('common.child') : t('common.children')}
      </span>
      <span className="row row-2">
        <IconClock size={13} />
        {f.availabilityLabel(family.availabilitySummary)}
      </span>
    </div>
  );
}

/* ========================================================================== */
/* Disclosure explainer                                                        */
/* ========================================================================== */

/**
 * Tells the viewer, in plain words, what they are and are not being shown — and why.
 * Making the limits visible is part of the trust story: a parent who can see that we
 * withhold detail from strangers can infer that we withhold their detail too.
 */
export function DisclosureNotice({ tier }: { tier: number }) {
  const t = useT();
  if (tier >= 2) {
    return (
      <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
        <IconCheck size={14} style={{ marginTop: 2, color: 'var(--ok-500)', flexShrink: 0 }} />
        <span>{t('disclosure.connected')}</span>
      </div>
    );
  }

  return (
    <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
      <IconLock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{t('disclosure.limited')}</span>
    </div>
  );
}

/* ========================================================================== */
/* Section header helper                                                       */
/* ========================================================================== */

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="row row-between row-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>{title}</h2>
        {description && (
          <p className="small muted" style={{ marginTop: 4, maxWidth: '62ch' }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Playdate style chips. Exported as a hook-friendly helper for call sites. */
export function useStyleLabel() {
  const { t } = useI18n();
  return (style: PlaydateStyle) => t(`style.${style}` as never);
}
