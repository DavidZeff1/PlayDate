import type { Family } from '../types';
import { DEFAULT_SCORERS, childInterestAffinity, distanceBandKey } from './scorers';
import type { TKey, TVars } from '../../i18n/types';
import type {
  MatchBand,
  MatchContext,
  MatchResult,
  MatchReason,
  Scorer,
  ScorerBreakdown,
  ChildPairing,
} from './types';

/**
 * Great-circle distance in km. Used only inside the service layer; the result is
 * converted to a band before it reaches any client-facing projection.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bandFor(score: number): MatchBand {
  if (score >= 0.78) return 'strong';
  if (score >= 0.6) return 'good';
  if (score >= 0.4) return 'possible';
  return 'weak';
}

/** Band labels as translation keys. The UI renders `t(BAND_KEYS[band])`. */
export const BAND_KEYS: Record<MatchBand, TKey> = {
  strong: 'band.strong',
  good: 'band.good',
  possible: 'band.possible',
  weak: 'band.weak',
};

/**
 * Which children plausibly pair up. Parents care about *which* child might get on with
 * *which* child, not an abstract family-level number.
 */
function computePairings(viewer: Family, candidate: Family): ChildPairing[] {
  const pairings: ChildPairing[] = [];
  for (const mine of viewer.children) {
    for (const theirs of candidate.children) {
      const { score, shared } = childInterestAffinity(mine, theirs);
      pairings.push({
        viewerChildId: mine.id,
        viewerChildName: mine.nickname || mine.firstName,
        candidateChildId: theirs.id,
        candidateChildName: theirs.nickname || theirs.firstName,
        ageGap: Math.abs(mine.age - theirs.age),
        sharedInterestIds: shared,
        affinity: score,
      });
    }
  }
  return pairings.sort((a, b) => b.affinity - a.affinity || a.ageGap - b.ageGap);
}

export interface MatchEngineOptions {
  scorers?: Scorer[];
}

/**
 * The public matching entry point.
 *
 * Pure: no React, no network, no storage, no clock unless injected via `ctx.now`.
 * Called identically by the discovery list, the compatibility panel, and the tests.
 *
 * Returns a result even when the candidate is excluded, so the caller can distinguish
 * "not a good match" (rank lower) from "cannot meet" (remove from the pool).
 */
export function matchFamilies(
  viewer: Family,
  candidate: Family,
  ctx: MatchContext,
  options: MatchEngineOptions = {},
): MatchResult {
  const scorers = options.scorers ?? DEFAULT_SCORERS;

  const blocked =
    ctx.blockedFamilyIds?.has(candidate.id) === true;

  if (blocked) {
    return excluded(candidate.id, 'exclude.blocked');
  }

  // A family that isn't discoverable, isn't in good standing, or has no children is not
  // a candidate at all. Checked here as well as in the service layer.
  if (!candidate.privacy.discoverable) {
    return excluded(candidate.id, 'exclude.notDiscoverable');
  }
  if (candidate.accountState !== 'active') {
    return excluded(candidate.id, 'exclude.notAvailable');
  }
  if (candidate.children.length === 0) {
    return excluded(candidate.id, 'exclude.noChildrenOnProfile');
  }

  const breakdown: ScorerBreakdown[] = [];
  const reasons: MatchReason[] = [];
  let weightedTotal = 0;
  let weightSum = 0;
  let blockingKey: TKey | undefined;
  let blockingVars: TVars | undefined;

  for (const scorer of scorers) {
    const out = scorer.score(viewer, candidate, ctx);
    const weight = viewer.preferences.weights[scorer.weightKey];

    if (out.blocking) {
      blockingKey = out.blockingKey ?? 'exclude.notAvailable';
      blockingVars = out.blockingVars;
      break;
    }

    // Squared weights, for the same reason interests use them: a dimension the parent
    // called critical should dominate one they called a slight preference.
    const w = weight * weight;
    weightedTotal += out.value * w;
    weightSum += w;

    breakdown.push({
      id: scorer.id,
      label: scorer.label,
      value: out.value,
      weight,
      contribution: 0, // filled in below, once weightSum is final
      reasons: out.reasons,
    });
    reasons.push(...out.reasons);
  }

  if (blockingKey) {
    return excluded(candidate.id, blockingKey, blockingVars);
  }

  const score = weightSum === 0 ? 0 : weightedTotal / weightSum;

  for (const b of breakdown) {
    b.contribution = weightSum === 0 ? 0 : (b.value * b.weight * b.weight) / weightSum;
  }

  const pairings = computePairings(viewer, candidate);
  const sharedInterestIds = [...new Set(pairings.flatMap((p) => p.sharedInterestIds))];

  // Order reasons so the strongest, most specific ones lead.
  const ordered = [
    ...reasons.filter((r) => r.tone === 'positive'),
    ...reasons.filter((r) => r.tone === 'note'),
  ];

  return {
    candidateFamilyId: candidate.id,
    score,
    band: bandFor(score),
    excluded: false,
    reasons: ordered,
    breakdown: breakdown.sort((a, b) => b.contribution - a.contribution),
    pairings,
    sharedInterestIds,
  };
}

function excluded(candidateFamilyId: string, key: TKey, vars?: TVars): MatchResult {
  return {
    candidateFamilyId,
    score: 0,
    band: 'weak',
    excluded: true,
    exclusionKey: key,
    exclusionVars: vars,
    reasons: [],
    breakdown: [],
    pairings: [],
    sharedInterestIds: [],
  };
}

export interface RankedMatch {
  family: Family;
  result: MatchResult;
}

/**
 * Rank a pool of candidate families for one viewer.
 *
 * The product goal is a LARGE but carefully filtered pool, not one "perfect match":
 * excluded families are dropped (they cannot actually meet), and everything else is
 * returned in order so the parent does the choosing.
 */
export function rankFamilies(
  viewer: Family,
  candidates: Family[],
  opts: {
    blockedFamilyIds?: Set<string>;
    now?: Date;
    scorers?: Scorer[];
    /** Include excluded families with their reason — used by the "why not shown" view. */
    includeExcluded?: boolean;
  } = {},
): RankedMatch[] {
  const out: RankedMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.id === viewer.id) continue;

    const ctx: MatchContext = {
      distanceKm: haversineKm(viewer.approxLocation, candidate.approxLocation),
      blockedFamilyIds: opts.blockedFamilyIds,
      now: opts.now,
    };

    const result = matchFamilies(viewer, candidate, ctx, { scorers: opts.scorers });
    if (result.excluded && !opts.includeExcluded) continue;
    out.push({ family: candidate, result });
  }

  return out.sort((a, b) => b.result.score - a.result.score);
}

export { distanceBandKey };
export type { MatchResult, MatchReason, MatchContext, MatchBand, ScorerBreakdown, ChildPairing };
