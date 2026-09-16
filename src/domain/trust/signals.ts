import type { TrustSignal, TrustSignalKind, VerificationStatus } from '../types';
import type { TFunc, TKey } from '../../i18n/types';

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

export function signalLabelKey(kind: TrustSignalKind): TKey {
  return `trust.${kind}` as TKey;
}

export function signalDescriptionKey(kind: TrustSignalKind): TKey {
  return `trustDesc.${kind}` as TKey;
}



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

/**
 * Detail lines on a trust signal are composed ("Member since March 2024",
 * "11 playdates completed"), so they carry a key and values rather than a sentence.
 */
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
  return [
    { kind: 'email_verified', satisfied: input.emailVerified },
    { kind: 'phone_verified', satisfied: input.phoneVerified },
    {
      kind: 'government_id_verified',
      satisfied: input.idVerification === 'verified',
      detailKey:
        input.idVerification === 'verified'
          ? 'trust.idChecked'
          : input.idVerification === 'pending'
            ? 'trust.idInProgress'
            : undefined,
    },
    { kind: 'two_factor_enabled', satisfied: input.twoFactorEnabled },
    { kind: 'secondary_parent_verified', satisfied: input.secondaryParentVerified },
    { kind: 'profile_complete', satisfied: input.profileComplete },
    {
      kind: 'account_age',
      satisfied: input.accountAgeMonths >= 1,
      detailKey: 'trust.memberSince',
      // The joined date is passed through so the UI can format the month name in the
      // reader's language and calendar.
      detailDate: input.joinedAt,
      value: input.accountAgeMonths,
    },
    {
      kind: 'completed_playdates',
      satisfied: input.completedPlaydates > 0,
      detailKey:
        input.completedPlaydates === 0
          ? 'trust.noPlaydates'
          : input.completedPlaydates === 1
            ? 'trust.onePlaydateDone'
            : 'trust.playdatesDone',
      detailVars: { n: input.completedPlaydates },
      value: input.completedPlaydates,
    },
    {
      kind: 'community_standing',
      satisfied: input.upheldReports === 0,
      detailKey: input.upheldReports === 0 ? 'trust.noUpheldReports' : undefined,
    },
  ];
}

/** Verification status copy, as keys plus the tone the badge should take. */
export const VERIFICATION_TONE: Record<VerificationStatus, 'ok' | 'pending' | 'warn' | 'neutral'> = {
  verified: 'ok',
  pending: 'pending',
  failed: 'warn',
  required: 'warn',
  unstarted: 'neutral',
  expired: 'warn',
};

export function verificationLabelKey(s: VerificationStatus): TKey {
  return `verif.${s}.label` as TKey;
}

export function verificationDescKey(s: VerificationStatus): TKey {
  return `verif.${s}.desc` as TKey;
}

export function verificationLabel(s: VerificationStatus, t: TFunc): string {
  return t(verificationLabelKey(s));
}
