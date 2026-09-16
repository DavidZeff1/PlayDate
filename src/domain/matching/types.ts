import type { Family, ChildId } from '../types';

/**
 * A single human-readable justification for why a family surfaced. `MatchResult`
 * cannot be built without these — explainability is a type-level requirement, not a
 * UI convention. See `docs/ARCHITECTURE.md` §5.4.
 */
export interface MatchReason {
  /** The scorer that produced it. */
  source: string;
  /** Short sentence a parent can act on: "4 shared interests, including LEGO". */
  text: string;
  /** Positive reasons support the match; 'note' reasons are neutral caveats. */
  tone: 'positive' | 'note';
  /** Optional detail shown when the parent opens the full breakdown. */
  detail?: string;
}

export interface ScorerOutput {
  /** Normalised 0..1. */
  value: number;
  /**
   * If true, this candidate is not shown at all. Used for hard constraints (outside
   * travel radius, no availability overlap, blocked) rather than ranking them last.
   */
  blocking?: boolean;
  /** Why it's blocking — surfaced to the viewer's own diagnostics, never to the other family. */
  blockingReason?: string;
  reasons: MatchReason[];
}

export interface MatchContext {
  /** Distance in km between the two families' approximate centroids. */
  distanceKm: number;
  /** Families the viewer has blocked, or who have blocked the viewer. */
  blockedFamilyIds?: Set<string>;
  /** Current time, injectable so tests are deterministic. */
  now?: Date;
}

export interface Scorer {
  id: string;
  label: string;
  /** Which of `FamilyPreferences.weights` this scorer is weighted by. */
  weightKey: 'interests' | 'age' | 'distance' | 'availability' | 'style';
  score(viewer: Family, candidate: Family, ctx: MatchContext): ScorerOutput;
}

export type MatchBand = 'strong' | 'good' | 'possible' | 'weak';

export interface ScorerBreakdown {
  id: string;
  label: string;
  /** 0..1 raw score from the scorer. */
  value: number;
  /** The viewer's declared importance for this dimension (1–5). */
  weight: number;
  /** Share of the final score this dimension contributed, 0..1. */
  contribution: number;
  reasons: MatchReason[];
}

export interface ChildPairing {
  viewerChildId: ChildId;
  viewerChildName: string;
  candidateChildId: ChildId;
  candidateChildName: string;
  ageGap: number;
  sharedInterestIds: string[];
  /** 0..1 weighted interest affinity for this specific pairing. */
  affinity: number;
}

export interface MatchResult {
  candidateFamilyId: string;
  /**
   * 0..1. Exists for ranking and for future evaluation against real outcomes.
   * NEVER rendered as a headline percentage — see `band` and `reasons`.
   */
  score: number;
  band: MatchBand;
  /** True when a hard constraint excludes this family from the pool. */
  excluded: boolean;
  exclusionReason?: string;
  reasons: MatchReason[];
  breakdown: ScorerBreakdown[];
  /** Which children plausibly pair up, so parents see the actual point of the match. */
  pairings: ChildPairing[];
  sharedInterestIds: string[];
}
