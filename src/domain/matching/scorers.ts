import type { Child, Family, AvailabilitySlot, DayOfWeek } from '../types';
import type { TKey } from '../../i18n/types';
import type { Scorer, ScorerOutput, MatchReason } from './types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Day and time-block names are assembled into an availability phrase, which means the
 * scorer would otherwise be building an English sentence. Instead it emits the pieces
 * as keys and the UI joins them — `availabilityPhrase` in the UI layer does the
 * language-specific assembly.
 */
const DAY_KEYS: Record<DayOfWeek, TKey> = {
  sun: 'day.sun',
  mon: 'day.mon',
  tue: 'day.tue',
  wed: 'day.wed',
  thu: 'day.thu',
  fri: 'day.fri',
  sat: 'day.sat',
};

const BLOCK_KEYS = {
  morning: 'blockPlural.morning',
  afternoon: 'blockPlural.afternoon',
  evening: 'blockPlural.evening',
} as const;

function slotKey(s: AvailabilitySlot): string {
  return `${s.day}:${s.block}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Weighted interest affinity between one viewer child and one candidate child.
 *
 *     score = Σ(importance² · affinity) / Σ(importance²)
 *
 * `importance` is the VIEWER parent's declared weight (1–5) for that interest, and
 * `affinity` is how strongly the candidate child shares it (their own enthusiasm,
 * normalised to 0..1).
 *
 * Importance is squared on purpose. With linear weights, five 1-star interests would
 * outweigh a single 5-star one; squared, a "critical" interest is worth 25× a "not
 * important" one, so the thing the parent actually cares about cannot be outvoted by a
 * pile of trivia. The denominator normalises, so a parent who marks everything critical
 * gains no advantage — only the relative ordering of their own stars matters.
 *
 * Interests the candidate doesn't share contribute 0 to the numerator but still count in
 * the denominator (an unmet critical interest genuinely lowers the match). Interests the
 * candidate has and the viewer doesn't are simply ignored — breadth is not a penalty.
 */
export function childInterestAffinity(
  viewerChild: Child,
  candidateChild: Child,
): { score: number; shared: string[] } {
  if (viewerChild.interests.length === 0) return { score: 0.5, shared: [] };

  const candidateMap = new Map(candidateChild.interests.map((i) => [i.interestId, i.enthusiasm]));
  const shared: string[] = [];
  let numerator = 0;
  let denominator = 0;

  for (const own of viewerChild.interests) {
    const w = own.importance * own.importance;
    denominator += w;
    const theirEnthusiasm = candidateMap.get(own.interestId);
    if (theirEnthusiasm !== undefined) {
      shared.push(own.interestId);
      // Normalise 1–5 enthusiasm into 0.2–1.0 affinity. A shared interest is always
      // worth something, even if it isn't their favourite thing.
      numerator += w * (theirEnthusiasm / 5);
    }
  }

  return { score: denominator === 0 ? 0.5 : clamp01(numerator / denominator), shared };
}

/** The interests both families weighted highly — the ones worth naming in the UI. */
export function mutuallyImportantInterests(viewer: Family, candidate: Family): string[] {
  const viewerImportant = new Set<string>();
  for (const c of viewer.children) {
    for (const i of c.interests) if (i.importance >= 4) viewerImportant.add(i.interestId);
  }
  const out = new Set<string>();
  for (const c of candidate.children) {
    for (const i of c.interests) {
      if (viewerImportant.has(i.interestId) && i.enthusiasm >= 4) out.add(i.interestId);
    }
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Age compatibility
// ---------------------------------------------------------------------------

export const ageScorer: Scorer = {
  id: 'age',
  label: 'Ages',
  weightKey: 'age',
  score(viewer, candidate): ScorerOutput {
    const tolerance = viewer.preferences.ageFlexibilityYears;
    const reasons: MatchReason[] = [];

    let best = Infinity;
    let bestPair: [Child, Child] | null = null;
    for (const mine of viewer.children) {
      for (const theirs of candidate.children) {
        const gap = Math.abs(mine.age - theirs.age);
        if (gap < best) {
          best = gap;
          bestPair = [mine, theirs];
        }
      }
    }

    if (!bestPair || best === Infinity) {
      return {
        value: 0,
        blocking: true,
        blockingKey: 'exclude.noChildren',
        reasons: [],
      };
    }

    if (best > tolerance) {
      return {
        value: 0,
        blocking: true,
        blockingKey: 'exclude.ageGap',
        blockingVars: { gap: best, tolerance },
        reasons: [],
      };
    }

    // Full marks at a 0–1 year gap, tapering to 0 at the edge of tolerance.
    const value = best <= 1 ? 1 : clamp01(1 - (best - 1) / Math.max(1, tolerance));

    if (best === 0) {
      reasons.push({
        source: 'age',
        tone: 'positive',
        key: 'reason.sameAge',
        detailKey: 'reason.sameAgeDetail',
        detailVars: { age: bestPair[0].age },
      });
    } else if (best <= tolerance) {
      reasons.push({
        source: 'age',
        tone: 'positive',
        key: 'reason.inAgeRange',
        detailKey: best === 1 ? 'reason.inAgeRangeDetailOne' : 'reason.inAgeRangeDetail',
        detailVars: { gap: best, tolerance },
      });
    }

    return { value, reasons };
  },
};

// ---------------------------------------------------------------------------
// Weighted interests
// ---------------------------------------------------------------------------

export const interestScorer: Scorer = {
  id: 'interests',
  label: 'Shared interests',
  weightKey: 'interests',
  score(viewer, candidate): ScorerOutput {
    const reasons: MatchReason[] = [];
    const allShared = new Set<string>();
    let bestAffinity = 0;
    let total = 0;
    let pairs = 0;

    for (const mine of viewer.children) {
      for (const theirs of candidate.children) {
        const { score, shared } = childInterestAffinity(mine, theirs);
        shared.forEach((s) => allShared.add(s));
        total += score;
        pairs += 1;
        if (score > bestAffinity) bestAffinity = score;
      }
    }

    // Weight the single best child pairing most heavily — one strong friendship is the
    // point, not an average across every possible combination.
    const average = pairs === 0 ? 0 : total / pairs;
    const value = clamp01(bestAffinity * 0.7 + average * 0.3);

    const sharedList = [...allShared];
    if (sharedList.length > 0) {
      // The named interests are passed as ids; the UI translates and joins them with
      // the right separator for its locale.
      const named = sharedList.slice(0, 3).join('\u0000');
      reasons.push({
        source: 'interests',
        tone: 'positive',
        key: sharedList.length === 1 ? 'reason.oneSharedInterest' : 'reason.sharedInterests',
        vars: { n: sharedList.length, named },
        detailKey: sharedList.length > 1 ? 'reason.sharedInterestsDetail' : undefined,
        detailVars: sharedList.length > 1 ? { named } : undefined,
      });
    }

    const critical = mutuallyImportantInterests(viewer, candidate);
    for (const id of critical.slice(0, 2)) {
      reasons.push({
        source: 'interests',
        tone: 'positive',
        key: 'reason.mattersToBoth',
        vars: { interest: id },
        detailKey: 'reason.mattersToBothDetail',
      });
    }

    if (sharedList.length === 0) {
      reasons.push({
        source: 'interests',
        tone: 'note',
        key: 'reason.noOverlap',
        detailKey: 'reason.noOverlapDetail',
      });
    }

    return { value, reasons };
  },
};

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/** Coarse band as a translation key. Never an exact figure — see docs/ARCHITECTURE.md §3.1. */
export function distanceBandKey(km: number): TKey {
  if (km < 1) return 'dist.under1';
  if (km < 2) return 'dist.1to2';
  if (km < 4) return 'dist.2to4';
  if (km < 7) return 'dist.4to7';
  if (km < 12) return 'dist.7to12';
  if (km < 20) return 'dist.12to20';
  return 'dist.over20';
}

export const distanceScorer: Scorer = {
  id: 'distance',
  label: 'Distance',
  weightKey: 'distance',
  score(viewer, candidate, ctx): ScorerOutput {
    const km = ctx.distanceKm;
    // Hard constraint: either family's stated limit applies. Showing families who
    // cannot realistically meet wastes everyone's time.
    const limit = Math.min(viewer.preferences.maxTravelKm, candidate.preferences.maxTravelKm);
    if (km > limit) {
      return {
        value: 0,
        blocking: true,
        blockingKey: 'exclude.tooFar',
        blockingVars: { band: distanceBandKey(km), km: limit },
        reasons: [],
      };
    }

    const value = clamp01(1 - km / Math.max(1, viewer.preferences.maxTravelKm));
    return {
      value,
      reasons: [
        {
          source: 'distance',
          tone: 'positive',
          key: 'reason.distance',
          // `band` is itself a key; the UI resolves it before interpolating.
          vars: { band: distanceBandKey(km) },
          detailKey: 'reason.distanceDetail',
          detailVars: { km: viewer.preferences.maxTravelKm },
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export const availabilityScorer: Scorer = {
  id: 'availability',
  label: 'Availability',
  weightKey: 'availability',
  score(viewer, candidate): ScorerOutput {
    const mine = new Set(viewer.availability.map(slotKey));
    const overlap = candidate.availability.filter((s) => mine.has(slotKey(s)));

    if (overlap.length === 0) {
      return {
        value: 0,
        blocking: true,
        blockingKey: 'exclude.noAvailability',
        reasons: [],
      };
    }

    // Three overlapping slots is plenty of room to find a time.
    const value = clamp01(overlap.length / 3);

    // Emit the overlap as day/block key pairs; the UI assembles the phrase in its own
    // language, since word order and conjunctions differ between English and Hebrew.
    const byDay = new Map<DayOfWeek, string[]>();
    for (const s of overlap) {
      const list = byDay.get(s.day) ?? [];
      list.push(BLOCK_KEYS[s.block]);
      byDay.set(s.day, list);
    }
    const phrases = [...byDay.entries()]
      .slice(0, 2)
      .map(([day, blocks]) => [DAY_KEYS[day], ...blocks].join('\u0001'))
      .join('\u0000');

    return {
      value,
      reasons: [
        {
          source: 'availability',
          tone: 'positive',
          key: 'reason.availability',
          vars: { phrases },
          detailKey: overlap.length > 2 ? 'reason.availabilityDetail' : undefined,
          detailVars: overlap.length > 2 ? { n: overlap.length } : undefined,
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Playdate style
// ---------------------------------------------------------------------------

export const styleScorer: Scorer = {
  id: 'style',
  label: 'Playdate style',
  weightKey: 'style',
  score(viewer, candidate): ScorerOutput {
    const mine = new Set(viewer.preferences.styles);
    const shared = candidate.preferences.styles.filter((s) => mine.has(s));
    const union = new Set([...viewer.preferences.styles, ...candidate.preferences.styles]);

    if (union.size === 0) return { value: 0.5, reasons: [] };
    const value = clamp01(shared.length / Math.max(1, mine.size));

    const reasons: MatchReason[] = [];
    if (shared.length > 0) {
      reasons.push({
        source: 'style',
        tone: 'positive',
        key: 'reason.bothPrefer',
        // Style ids; the UI maps them to `stylePhrase.*` and joins.
        vars: { styles: shared.slice(0, 2).join('\u0000') },
      });
    }

    // A genuine mismatch worth naming rather than burying in a number.
    if (mine.has('parents_stay') && candidate.preferences.styles.includes('drop_off_ok') && !candidate.preferences.styles.includes('parents_stay')) {
      reasons.push({
        source: 'style',
        tone: 'note',
        key: 'reason.dropOffMismatch',
        detailKey: 'reason.dropOffMismatchDetail',
      });
    }

    return { value, reasons };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The scorer registry. Adding a dimension is adding a file and one line here — the
 * engine and the UI are untouched. Replacing the whole combination strategy (e.g. with
 * a model trained on real playdate outcomes) means implementing `Scorer` and swapping
 * this array.
 */
export const DEFAULT_SCORERS: Scorer[] = [
  ageScorer,
  interestScorer,
  distanceScorer,
  availabilityScorer,
  styleScorer,
];
