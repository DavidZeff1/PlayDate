import { describe, it, expect } from 'vitest';
import { projectFamily, redactForLog, summariseAvailability, locationLabel } from './redaction';
import { DisclosureTier } from '../types';
import type { Family } from '../types';
import { buildSeed } from '../../data/seed';

const seed = buildSeed();
const cohen = seed.families.find((f) => f.id === 'fam_cohen')!;
const cohenParent = seed.parentProfiles.find((p) => p.id === 'par_cohen')!;
const katz = seed.families.find((f) => f.id === 'fam_katz')!;

/**
 * These tests encode the product's central safety promise. If any of them fail, a
 * family's private information can reach another family — treat it as a release blocker,
 * not a flaky test.
 */
describe('projectFamily — what must never cross the boundary', () => {
  const projection = projectFamily(cohen, {
    tier: DisclosureTier.DISCOVERY,
    distanceKm: 3,
    parent: cohenParent,
  })!;

  it('returns an object with no address, phone, email or coordinates anywhere in it', () => {
    const serialised = JSON.stringify(projection);
    // Coordinates from the seed data.
    expect(serialised).not.toContain('31.77');
    expect(serialised).not.toContain('35.21');
    expect(serialised).not.toMatch(/"lat"/);
    expect(serialised).not.toMatch(/"lng"/);
    expect(serialised).not.toMatch(/@example\.com/);
    expect(serialised).not.toMatch(/\+972/);
    // The projection type has no such fields at all — this asserts the runtime shape too.
    expect(projection).not.toHaveProperty('approxLocation');
    expect(projection).not.toHaveProperty('homeAddress');
  });

  it('never exposes a legal name or date of birth', () => {
    const identity = seed.parentIdentities.find((p) => p.parentId === 'par_cohen')!;
    const serialised = JSON.stringify(projection);
    expect(serialised).not.toContain(identity.dateOfBirth);
    expect(serialised).not.toContain(identity.legalLastName + ',');
  });

  it('shows a general area rather than a neighbourhood at discovery tier', () => {
    const neighbourhoodFamily: Family = {
      ...cohen,
      privacy: { ...cohen.privacy, location: 'neighborhood' },
    };
    const discovery = projectFamily(neighbourhoodFamily, { tier: DisclosureTier.DISCOVERY })!;
    const connected = projectFamily(neighbourhoodFamily, { tier: DisclosureTier.CONNECTED })!;

    expect(discovery.locationLabel).toBe('Jerusalem area');
    expect(connected.locationLabel).toContain('Rehavia');
  });

  it('returns a distance band, never an exact distance', () => {
    const withDistance = projectFamily(cohen, {
      tier: DisclosureTier.DISCOVERY,
      distanceKm: 3.14159,
    })!;
    expect(withDistance.distanceBand).toBe('2–4 km');
    expect(JSON.stringify(withDistance)).not.toContain('3.14');
  });

  it('returns null at NONE tier rather than a stripped object to probe', () => {
    expect(projectFamily(cohen, { tier: DisclosureTier.NONE })).toBeNull();
  });

  it('returns null for a family who has turned off discoverability', () => {
    const hidden: Family = { ...cohen, privacy: { ...cohen.privacy, discoverable: false } };
    expect(projectFamily(hidden, { tier: DisclosureTier.DISCOVERY })).toBeNull();
    // ...but the family can still see itself.
    expect(projectFamily(hidden, { tier: DisclosureTier.SELF })).not.toBeNull();
  });
});

describe('projectFamily — children', () => {
  it('honours a hidden name setting', () => {
    const hiddenNames: Family = { ...cohen, privacy: { ...cohen.privacy, childName: 'hidden' } };
    const p = projectFamily(hiddenNames, { tier: DisclosureTier.DISCOVERY })!;
    expect(p.children[0].displayName).toBe('Child 1');
    expect(JSON.stringify(p)).not.toContain('Noa');
  });

  it('honours a nickname setting', () => {
    const p = projectFamily(katz, { tier: DisclosureTier.DISCOVERY })!;
    // Katz chose nickname disclosure; Talia's nickname is Tali.
    expect(p.children[0].displayName).toBe('Tali');
    expect(JSON.stringify(p)).not.toContain('Talia');
  });

  it('bands ages when the parent chose range disclosure', () => {
    const p = projectFamily(katz, { tier: DisclosureTier.DISCOVERY })!;
    expect(p.children[0].ageLabel).toBe('7–9 years old');
  });

  it('never leaks a surname through a child name', () => {
    const p = projectFamily(cohen, { tier: DisclosureTier.CONNECTED })!;
    for (const c of p.children) {
      expect(c.displayName).not.toContain('Cohen');
    }
  });

  it('withholds parent-written child notes until families connect', () => {
    const discovery = projectFamily(cohen, { tier: DisclosureTier.DISCOVERY })!;
    const connected = projectFamily(cohen, { tier: DisclosureTier.CONNECTED })!;

    expect(discovery.children.every((c) => c.notes === undefined)).toBe(true);
    expect(connected.children.some((c) => typeof c.notes === 'string')).toBe(true);
  });

  it('keeps photos hidden by default and behind consent when set to on_request', () => {
    const withPhoto: Family = {
      ...cohen,
      children: cohen.children.map((c) => ({ ...c, photoRef: 'photo_1' })),
    };

    const defaultHidden = projectFamily(withPhoto, { tier: DisclosureTier.CONNECTED })!;
    expect(defaultHidden.children.every((c) => !c.photoVisible)).toBe(true);

    const onRequest: Family = {
      ...withPhoto,
      privacy: { ...withPhoto.privacy, childPhotos: 'on_request' },
    };

    // Connected but no consent granted → still hidden.
    const noConsent = projectFamily(onRequest, { tier: DisclosureTier.CONNECTED })!;
    expect(noConsent.children.every((c) => !c.photoVisible)).toBe(true);

    // Connected AND consent granted → visible.
    const consented = projectFamily(onRequest, {
      tier: DisclosureTier.CONNECTED,
      photoConsentGranted: true,
    })!;
    expect(consented.children.every((c) => c.photoVisible)).toBe(true);

    // Consent alone is not enough without a connection.
    const discoveryConsent = projectFamily(onRequest, {
      tier: DisclosureTier.DISCOVERY,
      photoConsentGranted: true,
    })!;
    expect(discoveryConsent.children.every((c) => !c.photoVisible)).toBe(true);
  });
});

describe('projectFamily — availability', () => {
  it('gives only a coarse summary at discovery tier', () => {
    const p = projectFamily(cohen, { tier: DisclosureTier.DISCOVERY })!;
    // A stranger must not learn the family's weekly routine.
    expect(p.availability).toBeUndefined();
    expect(p.availabilitySummary.length).toBeGreaterThan(0);
  });

  it('gives detail once connected, if the family allows it', () => {
    const detailed: Family = {
      ...cohen,
      privacy: { ...cohen.privacy, availabilityDetail: 'detailed' },
    };
    const p = projectFamily(detailed, { tier: DisclosureTier.CONNECTED })!;
    expect(p.availability?.length).toBeGreaterThan(0);
  });

  it('summarises weekend-only availability in plain language', () => {
    expect(
      summariseAvailability([
        { day: 'fri', block: 'afternoon' },
        { day: 'sat', block: 'afternoon' },
      ]),
    ).toBe('Weekend afternoons');
  });
});

describe('locationLabel', () => {
  it('says nothing useful when location is hidden', () => {
    const hidden: Family = { ...cohen, privacy: { ...cohen.privacy, location: 'hidden' } };
    expect(locationLabel(hidden, DisclosureTier.CONNECTED)).toBe('Location not shared');
  });
});

describe('redactForLog', () => {
  it('strips personal fields from anything written to an audit log', () => {
    const redacted = redactForLog({
      email: 'maya@example.com',
      phone: '+972-50-000-0000',
      firstName: 'Noa',
      body: 'a private message',
      preciseLocation: { lat: 31.77, lng: 35.21 },
      familyId: 'fam_cohen',
      action: 'request_sent',
    }) as Record<string, unknown>;

    expect(redacted.email).toBe('[redacted]');
    expect(redacted.phone).toBe('[redacted]');
    expect(redacted.firstName).toBe('[redacted]');
    expect(redacted.body).toBe('[redacted]');
    expect(redacted.preciseLocation).toBe('[redacted]');
    // Non-personal operational fields survive, so logs stay useful.
    expect(redacted.familyId).toBe('fam_cohen');
    expect(redacted.action).toBe('request_sent');
  });

  it('truncates long strings and bounds recursion', () => {
    const long = 'x'.repeat(500);
    expect(String(redactForLog({ note: long })).length).toBeLessThan(200);
    const deep = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    expect(JSON.stringify(redactForLog(deep))).toContain('depth');
  });
});
