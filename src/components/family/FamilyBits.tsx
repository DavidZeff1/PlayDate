import type { ReactNode } from 'react';
import type {
  ChildProjection,
  FamilyProjection,
  PlaydateStyle,
  TrustSignal,
  VerificationStatus,
} from '../../domain/types';
import { interestEmoji, interestLabel } from '../../domain/interests';
import { SIGNAL_DESCRIPTIONS, SIGNAL_LABELS, VERIFICATION_COPY, discoverySignals } from '../../domain/trust/signals';
import { Avatar, Badge, Stars } from '../ui';
import { IconCheck, IconClock, IconLock, IconMapPin, IconUsers } from '../ui/Icons';

/* ========================================================================== */
/* Verification badge                                                          */
/* ========================================================================== */

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const copy = VERIFICATION_COPY[status];
  const tone = copy.tone === 'ok' ? 'ok' : copy.tone === 'pending' ? 'pending' : copy.tone === 'warn' ? 'warn' : 'neutral';
  return (
    <Badge tone={tone}>
      {status === 'verified' && <IconCheck size={11} />}
      {copy.label}
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
  const shown = compact ? discoverySignals(signals) : signals.filter((s) => s.satisfied);

  if (shown.length === 0) {
    return <span className="small muted">No verified signals yet</span>;
  }

  if (compact) {
    return (
      <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
        {shown.slice(0, 3).map((s) => (
          <span key={s.kind} className="badge badge-neutral" title={SIGNAL_DESCRIPTIONS[s.kind]}>
            <IconCheck size={10} />
            {s.detail ?? SIGNAL_LABELS[s.kind]}
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
            <div className="small strong">{s.detail ?? SIGNAL_LABELS[s.kind]}</div>
            <div className="tiny muted">{SIGNAL_DESCRIPTIONS[s.kind]}</div>
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
          {interestLabel(id)}
        </span>
      ))}
      {rest > 0 && <span className="interest-tag">+{rest} more</span>}
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
  return (
    <div className="stack stack-3">
      <div className="row row-3">
        <Avatar name={child.displayName} color={child.avatarColor} size="sm" />
        <div>
          <div className="strong" style={{ fontSize: 'var(--text-base)' }}>
            {child.displayName}
          </div>
          <div className="small muted">{child.ageLabel}</div>
        </div>
        {!child.photoVisible && (
          <span className="tiny muted row row-2" style={{ marginLeft: 'auto' }} title="Photos are off by default and need the parent's consent">
            <IconLock size={11} />
            No photo
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
  if (child.interests.length === 0) {
    return <p className="small muted">No interests added yet.</p>;
  }
  return (
    <ul className="stack stack-2">
      {[...child.interests]
        .sort((a, b) => b.enthusiasm - a.enthusiasm)
        .map((i) => (
          <li key={i.interestId} className="row row-between row-3">
            <span className="small row row-2">
              <span aria-hidden="true">{interestEmoji(i.interestId)}</span>
              {interestLabel(i.interestId)}
            </span>
            <Stars value={i.enthusiasm} size="readonly" label={interestLabel(i.interestId)} />
          </li>
        ))}
    </ul>
  );
}

/* ========================================================================== */
/* Family meta line                                                            */
/* ========================================================================== */

export const STYLE_LABELS: Record<PlaydateStyle, string> = {
  parents_stay: 'Parents stay',
  drop_off_ok: 'Drop-off welcome',
  public_places_only: 'Public places',
  home_visits_ok: 'Home visits OK',
  small_groups: 'Small groups',
  structured_activities: 'Planned activities',
};

export function FamilyMeta({ family }: { family: FamilyProjection }) {
  return (
    <div className="row row-wrap small muted" style={{ gap: 'var(--sp-4)' }}>
      <span className="row row-2">
        <IconMapPin size={13} />
        {family.locationLabel}
      </span>
      <span className="row row-2">
        <IconUsers size={13} />
        {family.childCount} {family.childCount === 1 ? 'child' : 'children'}
      </span>
      <span className="row row-2">
        <IconClock size={13} />
        {family.availabilitySummary}
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
  if (tier >= 2) {
    return (
      <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
        <IconCheck size={14} style={{ marginTop: 2, color: 'var(--ok-500)', flexShrink: 0 }} />
        <span>
          You are connected with this family, so you can see the details they chose to share
          with connected families. Home addresses, phone numbers and email addresses are never
          shared through PlayDate.
        </span>
      </div>
    );
  }

  return (
    <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
      <IconLock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>
        This is a limited profile. Exact location, contact details, schools and photos stay
        hidden until both families agree to connect — and the same applies to your family
        when others browse.
      </span>
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
