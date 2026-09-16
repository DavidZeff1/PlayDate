import { describe, it, expect } from 'vitest';
import { matchFamilies, rankFamilies, haversineKm } from './engine';
import { childInterestAffinity } from './scorers';
import { buildSeed } from '../../data/seed';
import type { Family, Child, Importance } from '../types';

const seed = buildSeed();
const byId = (id: string): Family => {
  const f = seed.families.find((x) => x.id === id);
  if (!f) throw new Error(`no family ${id}`);
  return f;
};

const cohen = byId('fam_cohen');

function ctxFor(a: Family, b: Family) {
  return { distanceKm: haversineKm(a.approxLocation, b.approxLocation) };
}

function child(overrides: Partial<Child> & { interests: Child['interests'] }): Child {
  return {
    id: 'c1',
    familyId: 'f1',
    firstName: 'Test',
    age: 8,
    avatarColor: '#000',
    ...overrides,
  };
}

const i = (id: string, enthusiasm: Importance, importance: Importance) => ({
  interestId: id,
  enthusiasm,
  importance,
});

describe('weighted interest affinity', () => {
  it('ranks one critical shared interest above many trivial ones', () => {
    // The core rule from the brief: importance must dominate raw count.
    const viewer = child({
      interests: [
        i('lego', 5, 5), // critical
        i('football', 3, 1),
        i('swimming', 3, 1),
        i('dance', 3, 1),
        i('chess', 3, 1),
      ],
    });

    const sharesTheCriticalOne = child({ interests: [i('lego', 5, 5)] });
    const sharesFourTrivialOnes = child({
      interests: [i('football', 5, 5), i('swimming', 5, 5), i('dance', 5, 5), i('chess', 5, 5)],
    });

    const critical = childInterestAffinity(viewer, sharesTheCriticalOne).score;
    const trivial = childInterestAffinity(viewer, sharesFourTrivialOnes).score;

    expect(critical).toBeGreaterThan(trivial);
    // And decisively so — not a rounding-error difference.
    expect(critical / trivial).toBeGreaterThan(5);
  });

  it('is not gamed by marking everything critical', () => {
    // A parent who rates all five interests 5/5 should get the same score as one who
    // rates all five 3/3 against the same candidate — only relative order matters.
    const allFives = child({ interests: [i('lego', 5, 5), i('drawing', 5, 5)] });
    const allThrees = child({ interests: [i('lego', 5, 3), i('drawing', 5, 3)] });
    const candidate = child({ interests: [i('lego', 5, 5)] });

    expect(childInterestAffinity(allFives, candidate).score).toBeCloseTo(
      childInterestAffinity(allThrees, candidate).score,
      5,
    );
  });

  it('does not penalise a candidate for extra interests the viewer lacks', () => {
    const viewer = child({ interests: [i('lego', 5, 5)] });
    const narrow = child({ interests: [i('lego', 5, 5)] });
    const broad = child({
      interests: [i('lego', 5, 5), i('dance', 5, 5), i('chess', 5, 5), i('baking', 5, 5)],
    });

    expect(childInterestAffinity(viewer, broad).score).toBeCloseTo(
      childInterestAffinity(viewer, narrow).score,
      5,
    );
  });

  it('scores an unmet critical interest below a met one', () => {
    const viewer = child({ interests: [i('lego', 5, 5), i('drawing', 5, 5)] });
    const meetsBoth = child({ interests: [i('lego', 5, 5), i('drawing', 5, 5)] });
    const meetsOne = child({ interests: [i('lego', 5, 5)] });

    expect(childInterestAffinity(viewer, meetsBoth).score).toBeGreaterThan(
      childInterestAffinity(viewer, meetsOne).score,
    );
  });
});

describe('matchFamilies', () => {
  it('always returns reasons for a non-excluded match', () => {
    const levi = byId('fam_levi');
    const result = matchFamilies(cohen, levi, ctxFor(cohen, levi));

    expect(result.excluded).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    // Explainability is the product requirement: a score with no reasons is a bug.
    expect(result.reasons.every((r) => r.text.length > 0)).toBe(true);
  });

  it('produces a band, never a bare percentage as the headline', () => {
    const levi = byId('fam_levi');
    const result = matchFamilies(cohen, levi, ctxFor(cohen, levi));
    expect(['strong', 'good', 'possible', 'weak']).toContain(result.band);
  });

  it('excludes families outside the age tolerance rather than ranking them last', () => {
    // Green's children are 12 and 13; Cohen's are 8 and 6 with a 2-year tolerance.
    const green = byId('fam_green');
    const result = matchFamilies(cohen, green, ctxFor(cohen, green));

    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toMatch(/years apart/i);
  });

  it('excludes families beyond the travel radius', () => {
    const far: Family = {
      ...byId('fam_levi'),
      id: 'fam_far',
      approxLocation: { lat: 32.08, lng: 34.78 }, // ~55 km away
    };
    const result = matchFamilies(cohen, far, ctxFor(cohen, far));
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toMatch(/beyond/i);
  });

  it('excludes families with no overlapping availability', () => {
    const noOverlap: Family = {
      ...byId('fam_levi'),
      id: 'fam_nooverlap',
      availability: [{ day: 'mon', block: 'morning' }],
    };
    const result = matchFamilies(cohen, noOverlap, ctxFor(cohen, noOverlap));
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toMatch(/availability/i);
  });

  it('excludes blocked families', () => {
    const levi = byId('fam_levi');
    const result = matchFamilies(cohen, levi, {
      ...ctxFor(cohen, levi),
      blockedFamilyIds: new Set(['fam_levi']),
    });
    expect(result.excluded).toBe(true);
    expect(result.exclusionReason).toBe('Blocked');
  });

  it('excludes families who have turned off discoverability', () => {
    const hidden: Family = {
      ...byId('fam_levi'),
      id: 'fam_hidden',
      privacy: { ...byId('fam_levi').privacy, discoverable: false },
    };
    const result = matchFamilies(cohen, hidden, ctxFor(cohen, hidden));
    expect(result.excluded).toBe(true);
  });

  it('respects the viewer\'s own weights — different parents get different orderings', () => {
    // Same two candidates, two viewers who weight distance very differently.
    const nearbyDifferentInterests = byId('fam_friedman'); // Rehavia, baking/music
    const fartherSharedInterests = byId('fam_bendavid'); // Ein Kerem, ~5km

    const distanceObsessed: Family = {
      ...cohen,
      preferences: {
        ...cohen.preferences,
        maxTravelKm: 20,
        ageFlexibilityYears: 4,
        weights: { interests: 1, age: 1, distance: 5, availability: 1, style: 1 },
      },
    };
    const interestObsessed: Family = {
      ...cohen,
      preferences: {
        ...cohen.preferences,
        maxTravelKm: 20,
        ageFlexibilityYears: 4,
        weights: { interests: 5, age: 1, distance: 1, availability: 1, style: 1 },
      },
    };

    const dNear = matchFamilies(distanceObsessed, nearbyDifferentInterests, ctxFor(cohen, nearbyDifferentInterests));
    const dFar = matchFamilies(distanceObsessed, fartherSharedInterests, ctxFor(cohen, fartherSharedInterests));
    expect(dNear.score).toBeGreaterThan(dFar.score);

    const iNear = matchFamilies(interestObsessed, nearbyDifferentInterests, ctxFor(cohen, nearbyDifferentInterests));
    const iFar = matchFamilies(interestObsessed, fartherSharedInterests, ctxFor(cohen, fartherSharedInterests));
    // The interest-driven viewer should value the two families more evenly, or flip the
    // order entirely — the point is that weights actually change the outcome.
    expect(iNear.score - iFar.score).toBeLessThan(dNear.score - dFar.score);
  });

  it('names the specific children who might pair up', () => {
    const peretz = byId('fam_peretz');
    const result = matchFamilies(cohen, peretz, ctxFor(cohen, peretz));
    expect(result.pairings.length).toBe(cohen.children.length * peretz.children.length);
    // Best pairing first.
    expect(result.pairings[0].affinity).toBeGreaterThanOrEqual(result.pairings[1].affinity);
  });

  it('never matches a family against itself', () => {
    const ranked = rankFamilies(cohen, seed.families);
    expect(ranked.some((r) => r.family.id === cohen.id)).toBe(false);
  });
});

describe('rankFamilies', () => {
  it('returns a pool of candidates, not a single best match', () => {
    const ranked = rankFamilies(cohen, seed.families);
    // The product goal is a large, filtered pool.
    expect(ranked.length).toBeGreaterThan(4);
  });

  it('is ordered by score descending', () => {
    const ranked = rankFamilies(cohen, seed.families);
    for (let n = 1; n < ranked.length; n += 1) {
      expect(ranked[n - 1].result.score).toBeGreaterThanOrEqual(ranked[n].result.score);
    }
  });

  it('drops excluded families by default and can surface them on request', () => {
    const shown = rankFamilies(cohen, seed.families);
    const all = rankFamilies(cohen, seed.families, { includeExcluded: true });
    expect(all.length).toBeGreaterThan(shown.length);
    expect(shown.every((r) => !r.result.excluded)).toBe(true);
  });

  it('puts the Levi family high for the Cohen family (the brief\'s worked example)', () => {
    const ranked = rankFamilies(cohen, seed.families);
    const rank = ranked.findIndex((r) => r.family.id === 'fam_levi');
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(3);
  });
});

describe('haversineKm', () => {
  it('computes a plausible short distance', () => {
    const km = haversineKm({ lat: 31.7717, lng: 35.21 }, { lat: 31.762, lng: 35.208 });
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(2);
  });

  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 31.77, lng: 35.21 }, { lat: 31.77, lng: 35.21 })).toBeCloseTo(0, 6);
  });
});
