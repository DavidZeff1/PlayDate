import type { TrustSignal, TrustSignalKind, VerificationStatus } from '../types';

/**
 * Trust is presented as a SET OF FACTS, never as a score.
 *
 * A single number ("4.8 ★", "Trust: 92") would turn parents into ranked sellers and
 * invite two failures: families competing on a metric, and parents outsourcing a
 * judgement they should be making themselves. It would also make a false negative
 * catastrophic and unappealable — a low number follows you with no explanation.
 *
 * Instead each signal is independently verifiable, independently displayed, and
 * independently meaningful: "ID verified" and "Member since March 2024" tell a parent
 * something they can reason about. There is deliberately no aggregate function in this
 * file, and no ordering of families by trust anywhere in the product.
 */

export const SIGNAL_LABELS: Record<TrustSignalKind, string> = {
  email_verified: 'Email verified',
  phone_verified: 'Phone verified',
  government_id_verified: 'Government ID verified',
  two_factor_enabled: 'Two-factor authentication on',
  secondary_parent_verified: 'Second parent verified',
  profile_complete: 'Family profile complete',
  account_age: 'Account age',
  completed_playdates: 'Playdates completed',
  community_standing: 'Community standing',
};

export const SIGNAL_DESCRIPTIONS: Record<TrustSignalKind, string> = {
  email_verified: 'They confirmed a working email address.',
  phone_verified: 'They confirmed a working phone number by SMS code.',
  government_id_verified:
    'A third-party identity provider checked a government-issued ID against a selfie. PlayDate never stores the document.',
  two_factor_enabled: 'Their account requires a second factor at sign-in.',
  secondary_parent_verified: 'A second parent on this family has also completed verification.',
  profile_complete: 'They have filled in their family profile, children and availability.',
  account_age: 'How long they have been on PlayDate.',
  completed_playdates: 'Playdates confirmed by both families and marked as completed.',
  community_standing: 'No upheld safety reports against this family.',
};

/** Signals shown at discovery tier. The rest appear only once families connect. */
const DISCOVERY_VISIBLE: TrustSignalKind[] = [
  'government_id_verified',
  'phone_verified',
  'email_verified',
  'account_age',
  'completed_playdates',
];

export function discoverySignals(signals: TrustSignal[]): TrustSignal[] {
  return signals.filter((s) => DISCOVERY_VISIBLE.includes(s.kind) && s.satisfied);
}

export function buildTrustSignals(input: {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerification: VerificationStatus;
  twoFactorEnabled: boolean;
  secondaryParentVerified: boolean;
  profileComplete: boolean;
  accountAgeMonths: number;
  completedPlaydates: number;
  upheldReports: number;
  joinedAt: string;
}): TrustSignal[] {
  const joined = new Date(input.joinedAt);
  const monthLabel = joined.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return [
    { kind: 'email_verified', satisfied: input.emailVerified },
    { kind: 'phone_verified', satisfied: input.phoneVerified },
    {
      kind: 'government_id_verified',
      satisfied: input.idVerification === 'verified',
      detail:
        input.idVerification === 'verified'
          ? 'Checked by an identity provider'
          : input.idVerification === 'pending'
            ? 'Check in progress'
            : undefined,
    },
    { kind: 'two_factor_enabled', satisfied: input.twoFactorEnabled },
    { kind: 'secondary_parent_verified', satisfied: input.secondaryParentVerified },
    { kind: 'profile_complete', satisfied: input.profileComplete },
    {
      kind: 'account_age',
      satisfied: input.accountAgeMonths >= 1,
      detail: `Member since ${monthLabel}`,
      value: input.accountAgeMonths,
    },
    {
      kind: 'completed_playdates',
      satisfied: input.completedPlaydates > 0,
      detail:
        input.completedPlaydates === 0
          ? 'No playdates yet'
          : `${input.completedPlaydates} playdate${input.completedPlaydates === 1 ? '' : 's'} completed`,
      value: input.completedPlaydates,
    },
    {
      kind: 'community_standing',
      satisfied: input.upheldReports === 0,
      detail: input.upheldReports === 0 ? 'No upheld reports' : undefined,
    },
  ];
}

export const VERIFICATION_COPY: Record<
  VerificationStatus,
  { label: string; tone: 'ok' | 'pending' | 'warn' | 'neutral'; description: string }
> = {
  verified: {
    label: 'Parent verified',
    tone: 'ok',
    description: 'This parent completed identity verification.',
  },
  pending: {
    label: 'Verification pending',
    tone: 'pending',
    description: 'Identity verification is in progress. Discovery unlocks once it completes.',
  },
  failed: {
    label: 'Verification failed',
    tone: 'warn',
    description: 'Identity verification did not complete. You can retry or contact support.',
  },
  required: {
    label: 'Verification required',
    tone: 'warn',
    description: 'Identity verification is required before you can browse or contact families.',
  },
  unstarted: {
    label: 'Verification not started',
    tone: 'neutral',
    description: 'Start verification to unlock discovery.',
  },
  expired: {
    label: 'Verification expired',
    tone: 'warn',
    description: 'Your verification has expired and needs renewing.',
  },
};
