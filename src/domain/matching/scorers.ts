import type { Child, Family, AvailabilitySlot, DayOfWeek } from '../types';
import { interestLabel } from '../interests';
import type { Scorer, ScorerOutput, MatchReason } from './types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DAY_LABELS: Record<DayOfWeek, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

const BLOCK_LABELS = {
  morning: 'mornings',
  afternoon: 'afternoons',
  evening: 'evenings',
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
        blockingReason: 'No children to compare',
        reasons: [],
      };
    }

    if (best > tolerance) {
      return {
        value: 0,
        blocking: true,
        blockingReason: `Closest ages are ${best} years apart — outside your ${tolerance}-year range`,
        reasons: [],
      };
    }

    // Full marks at a 0–1 year gap, tapering to 0 at the edge of tolerance.
    const value = best <= 1 ? 1 : clamp01(1 - (best - 1) / Math.max(1, tolerance));

    if (best === 0) {
      reasons.push({
        source: 'age',
        tone: 'positive',
        text: 'Children are the same age',
        detail: `Both ${bestPair[0].age} years old.`,
      });
    } else if (best <= tolerance) {
      reasons.push({
        source: 'age',
        tone: 'positive',
        text: `Children are within your preferred age range`,
        detail: `Closest pairing is ${best} year${best === 1 ? '' : 's'} apart, inside your ${tolerance}-year preference.`,
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
      const named = sharedList.slice(0, 3).map(interestLabel).join(', ');
      reasons.push({
        source: 'interests',
        tone: 'positive',
        text:
          sharedList.length === 1
            ? `1 shared interest: ${named}`
            : `${sharedList.length} shared interests`,
        detail: sharedList.length > 1 ? `Including ${named}.` : undefined,
      });
    }

    const critical = mutuallyImportantInterests(viewer, candidate);
    for (const id of critical.slice(0, 2)) {
      reasons.push({
        source: 'interests',
        tone: 'positive',
        text: `${interestLabel(id)} matters to both families`,
        detail: 'You marked this highly important, and their child is enthusiastic about it too.',
      });
    }

    if (sharedList.length === 0) {
      reasons.push({
        source: 'interests',
        tone: 'note',
        text: 'No overlapping interests yet',
        detail: 'Children often find common ground in person — this is worth weighing, not a dealbreaker.',
      });
    }

    return { value, reasons };
  },
};

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/** Coarse band. Never an exact figure — see docs/ARCHITECTURE.md §3.1. */
export function distanceBand(km: number): string {
  if (km < 1) return 'Under 1 km';
  if (km < 2) return '1–2 km';
  if (km < 4) return '2–4 km';
  if (km < 7) return '4–7 km';
  if (km < 12) return '7–12 km';
  if (km < 20) return '12–20 km';
  return 'Over 20 km';
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
        blockingReason: `About ${distanceBand(km)} away — beyond the ${limit} km either family travels`,
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
          text: `Families are approximately ${distanceBand(km)} apart`,
          detail: `Within the ${viewer.preferences.maxTravelKm} km you're happy to travel.`,
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
        blockingReason: 'No overlapping availability',
        reasons: [],
      };
    }

    // Three overlapping slots is plenty of room to find a time.
    const value = clamp01(overlap.length / 3);

    // Describe the overlap the way a parent would say it out loud.
    const byDay = new Map<DayOfWeek, string[]>();
    for (const s of overlap) {
      const list = byDay.get(s.day) ?? [];
      list.push(BLOCK_LABELS[s.block]);
      byDay.set(s.day, list);
    }
    const phrases = [...byDay.entries()]
      .slice(0, 2)
      .map(([day, blocks]) => `${DAY_LABELS[day]} ${blocks.join(' and ')}`);

    return {
      value,
      reasons: [
        {
          source: 'availability',
          tone: 'positive',
          text: `Availability overlaps on ${phrases.join(', ')}`,
          detail:
            overlap.length > 2
              ? `${overlap.length} overlapping time slots in total.`
              : undefined,
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Playdate style
// ---------------------------------------------------------------------------

const STYLE_LABELS: Record<string, string> = {
  parents_stay: 'parents staying for the visit',
  drop_off_ok: 'drop-off playdates',
  public_places_only: 'meeting in public places',
  home_visits_ok: 'home visits',
  small_groups: 'small groups',
  structured_activities: 'a planned activity',
};

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
        text: `Both families prefer ${shared.slice(0, 2).map((s) => STYLE_LABELS[s] ?? s).join(' and ')}`,
      });
    }

    // A genuine mismatch worth naming rather than burying in a number.
    if (mine.has('parents_stay') && candidate.preferences.styles.includes('drop_off_ok') && !candidate.preferences.styles.includes('parents_stay')) {
      reasons.push({
        source: 'style',
        tone: 'note',
        text: 'They are open to drop-off playdates; you prefer to stay',
        detail: 'Worth agreeing on before the first meeting.',
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
