import {
  DisclosureTier,
  type AvailabilitySlot,
  type Child,
  type ChildProjection,
  type DayOfWeek,
  type Family,
  type FamilyProjection,
  type ParentProfile,
  type TimeBlock,
} from '../types';
import { distanceBand } from '../matching/scorers';

/**
 * THE CHOKE POINT.
 *
 * This is the only place a `Family` becomes viewable by anyone other than its own
 * members. The service layer never hands a raw `Family` to another family — it hands a
 * `FamilyProjection`, which is a different type that *structurally does not contain*
 * an address, phone number, email, legal name, date of birth, school, or coordinates.
 *
 * That matters more than a permission check: a future UI bug, a debug panel, or a
 * careless `JSON.stringify` cannot leak fields that were never put in the object.
 *
 * Disclosure rises only through consent:
 *   NONE      → nothing
 *   DISCOVERY → browsing: general area, ages, interests, coarse availability
 *   CONNECTED → after mutual acceptance: chosen names, notes, detail, photos if consented
 *   PLANNING  → an agreed playdate exists
 *   SELF      → the family's own record
 */

const DAY_ORDER: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DAY_SHORT: Record<DayOfWeek, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

const BLOCK_LABEL: Record<TimeBlock, string> = {
  morning: 'mornings',
  afternoon: 'afternoons',
  evening: 'evenings',
};

const WEEKEND: DayOfWeek[] = ['fri', 'sat'];

/**
 * A coarse, human phrase — "Weekend afternoons", "Weekday afternoons and evenings".
 * Used at DISCOVERY tier so a stranger cannot learn a family's weekly routine, which is
 * exactly the information you would want to know in order to find a child predictably.
 */
export function summariseAvailability(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) return 'No availability set';

  const days = new Set(slots.map((s) => s.day));
  const blocks = new Set(slots.map((s) => s.block));

  const allWeekend = [...days].every((d) => WEEKEND.includes(d));
  const allWeekday = [...days].every((d) => !WEEKEND.includes(d));

  const blockPhrase = [...blocks]
    .sort((a, b) => ['morning', 'afternoon', 'evening'].indexOf(a) - ['morning', 'afternoon', 'evening'].indexOf(b))
    .map((b) => BLOCK_LABEL[b])
    .join(' and ');

  if (allWeekend) return `Weekend ${blockPhrase}`;
  if (allWeekday) return `Weekday ${blockPhrase}`;
  return `Most days, ${blockPhrase}`;
}

/** Detailed grid label, only ever shown at CONNECTED tier or above. */
export function describeAvailability(slots: AvailabilitySlot[]): string[] {
  const byDay = new Map<DayOfWeek, TimeBlock[]>();
  for (const s of slots) {
    const list = byDay.get(s.day) ?? [];
    list.push(s.block);
    byDay.set(s.day, list);
  }
  return DAY_ORDER.filter((d) => byDay.has(d)).map(
    (d) => `${DAY_SHORT[d]}: ${(byDay.get(d) ?? []).map((b) => BLOCK_LABEL[b]).join(', ')}`,
  );
}

/**
 * Location label. Never an address, never coordinates.
 *
 * `approximate_distance` deliberately returns a band ("About 2–4 km away") rather than a
 * figure. An exact distance from a known point is a circle; three exact distances are a
 * position. Bands make that trilateration attack impractical.
 */
export function locationLabel(
  family: Family,
  tier: DisclosureTier,
  distanceKm?: number,
): string {
  if (tier === DisclosureTier.SELF) {
    return family.neighborhood ? `${family.neighborhood}, ${family.generalArea}` : family.generalArea;
  }

  switch (family.privacy.location) {
    case 'hidden':
      return 'Location not shared';
    case 'general_area':
      return family.generalArea;
    case 'neighborhood':
      // Neighbourhood is finer-grained, so it is held back until families connect.
      return tier >= DisclosureTier.CONNECTED && family.neighborhood
        ? `${family.neighborhood}, ${family.generalArea}`
        : family.generalArea;
    case 'approximate_distance':
      return distanceKm === undefined
        ? family.generalArea
        : `About ${distanceBand(distanceKm)} away`;
    default:
      return family.generalArea;
  }
}

/** Child display name, honouring the parent's choice. Never a surname, ever. */
export function childDisplayName(child: Child, family: Family, index: number, tier: DisclosureTier): string {
  if (tier === DisclosureTier.SELF) return child.nickname ? `${child.firstName} (${child.nickname})` : child.firstName;

  switch (family.privacy.childName) {
    case 'hidden':
      return `Child ${index + 1}`;
    case 'nickname':
      return child.nickname || `Child ${index + 1}`;
    case 'first_name':
      return child.firstName;
    default:
      return `Child ${index + 1}`;
  }
}

/** Age label: exact, or a ±1 band when the parent chose range disclosure. */
export function childAgeLabel(child: Child, family: Family, tier: DisclosureTier): string {
  if (tier === DisclosureTier.SELF || family.privacy.childAges === 'exact') {
    return `${child.age} years old`;
  }
  const low = Math.max(1, child.age - 1);
  return `${low}–${child.age + 1} years old`;
}

function projectChild(
  child: Child,
  family: Family,
  index: number,
  tier: DisclosureTier,
  photoConsentGranted: boolean,
): ChildProjection {
  const connected = tier >= DisclosureTier.CONNECTED;

  // Photo visibility requires BOTH a permissive setting AND, for `on_request`, an
  // explicit per-family consent grant. Default is hidden.
  const photoVisible =
    Boolean(child.photoRef) &&
    (tier === DisclosureTier.SELF ||
      (family.privacy.childPhotos === 'connected_families' && connected) ||
      (family.privacy.childPhotos === 'on_request' && connected && photoConsentGranted));

  return {
    id: child.id,
    displayName: childDisplayName(child, family, index, tier),
    ageLabel: childAgeLabel(child, family, tier),
    age: child.age,
    // Interests are the point of the product, so they are shown at discovery tier —
    // but only the interest id and enthusiasm, never a free-text note.
    interests: child.interests.map((i) => ({ interestId: i.interestId, enthusiasm: i.enthusiasm })),
    temperament: connected ? child.temperament : undefined,
    // Parent-written notes can contain identifying detail ("the school down our road"),
    // so they are held back until families have mutually consented.
    notes: connected ? child.notes : undefined,
    photoVisible,
    avatarColor: child.avatarColor,
  };
}

export interface ProjectionOptions {
  tier: DisclosureTier;
  /** Distance in km, if the viewer is entitled to a distance band. */
  distanceKm?: number;
  /** The primary parent's social profile — used for name/bio/trust signals. */
  parent?: ParentProfile;
  /** Whether this specific viewer has been granted photo consent. */
  photoConsentGranted?: boolean;
}

/**
 * Build the only representation of a family that may cross a trust boundary.
 *
 * Returns `null` at `DisclosureTier.NONE` — an unverified or logged-out viewer gets
 * nothing at all, not a stripped-down object they might probe.
 */
export function projectFamily(
  family: Family,
  options: ProjectionOptions,
): FamilyProjection | null {
  const { tier, distanceKm, parent, photoConsentGranted = false } = options;

  if (tier === DisclosureTier.NONE) return null;
  if (tier < DisclosureTier.SELF && !family.privacy.discoverable) return null;

  const connected = tier >= DisclosureTier.CONNECTED;

  const showBio =
    tier === DisclosureTier.SELF ||
    connected ||
    family.privacy.parentBio === 'discovery';

  const showDetailedAvailability =
    tier === DisclosureTier.SELF ||
    (connected && family.privacy.availabilityDetail === 'detailed');

  return {
    id: family.id,
    displayName: family.displayName,
    locationLabel: locationLabel(family, tier, distanceKm),
    tier,
    children: family.children.map((c, i) => projectChild(c, family, i, tier, photoConsentGranted)),
    childCount: family.children.length,
    verificationStatus: family.verificationStatus,
    // Trust signals are individual facts, not a rank. See trust/signals.ts.
    trustSignals: parent?.trustSignals ?? [],
    about: family.about,
    parentDisplayName: connected || tier === DisclosureTier.SELF ? parent?.displayName : undefined,
    parentBio: showBio ? parent?.bio : undefined,
    languages: family.languages,
    availabilitySummary: summariseAvailability(family.availability),
    availability: showDetailedAvailability ? family.availability : undefined,
    styles: family.preferences.styles,
    distanceBand: distanceKm === undefined ? undefined : distanceBand(distanceKm),
    memberSince: family.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Privacy-aware logging
// ---------------------------------------------------------------------------

const PII_KEYS = new Set([
  'email',
  'phone',
  'password',
  'passwordHash',
  'legalFirstName',
  'legalLastName',
  'dateOfBirth',
  'homeAddress',
  'preciseLocation',
  'approxLocation',
  'lat',
  'lng',
  'verificationProviderRef',
  'firstName',
  'nickname',
  'notes',
  'body',
  'details',
  'token',
]);

/**
 * Strip personal data before anything is written to a log or audit entry.
 *
 * Audit logs are read by operators during incidents; they must record *what happened*
 * without becoming a second, less protected copy of the family database.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 64 ? `${value.slice(0, 32)}…[truncated]` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redactForLog(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k) ? '[redacted]' : redactForLog(v, depth + 1);
    }
    return out;
  }
  return '[unserialisable]';
}
