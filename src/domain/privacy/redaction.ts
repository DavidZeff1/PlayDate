import {
  DisclosureTier,
  type AgeDisclosureView,
  type AvailabilitySlot,
  type AvailabilityView,
  type Child,
  type ChildProjection,
  type DayOfWeek,
  type Family,
  type FamilyProjection,
  type LocationView,
  type ParentProfile,
  type TimeBlock,
} from '../types';
import { distanceBandKey } from '../matching/scorers';

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

const BLOCK_ORDER: TimeBlock[] = ['morning', 'afternoon', 'evening'];

const WEEKEND: DayOfWeek[] = ['fri', 'sat'];

/**
 * A coarse availability summary — "weekend afternoons", "weekday afternoons and
 * evenings" — as structured data rather than a phrase.
 *
 * Coarse on purpose: at DISCOVERY tier a stranger must not be able to learn a family's
 * weekly routine, which is precisely what you would want in order to find a child
 * predictably. Structured on purpose: word order differs between languages, so the
 * sentence is assembled in the UI.
 */
export function summariseAvailability(slots: AvailabilitySlot[]): AvailabilityView {
  if (slots.length === 0) return { scope: 'none', blocks: [] };

  const days = new Set(slots.map((s) => s.day));
  const blocks = [...new Set(slots.map((s) => s.block))].sort(
    (a, b) => BLOCK_ORDER.indexOf(a) - BLOCK_ORDER.indexOf(b),
  );

  const allWeekend = [...days].every((d) => WEEKEND.includes(d));
  const allWeekday = [...days].every((d) => !WEEKEND.includes(d));

  return {
    scope: allWeekend ? 'weekend' : allWeekday ? 'weekday' : 'mixed',
    blocks,
  };
}

/** Detailed grid, only ever shown at CONNECTED tier or above. Formatted by the UI. */
export function describeAvailability(
  slots: AvailabilitySlot[],
): Array<{ day: DayOfWeek; blocks: TimeBlock[] }> {
  const byDay = new Map<DayOfWeek, TimeBlock[]>();
  for (const s of slots) {
    const list = byDay.get(s.day) ?? [];
    list.push(s.block);
    byDay.set(s.day, list);
  }
  return DAY_ORDER.filter((d) => byDay.has(d)).map((d) => ({
    day: d,
    blocks: byDay.get(d) ?? [],
  }));
}

/**
 * Location, as data. Never an address, never coordinates.
 *
 * `approximate_distance` deliberately yields a band key ("2–4 km") rather than a figure.
 * An exact distance from a known point is a circle; three exact distances are a
 * position. Bands make that trilateration attack impractical.
 */
export function locationView(
  family: Family,
  tier: DisclosureTier,
  distanceKm?: number,
): LocationView {
  if (tier === DisclosureTier.SELF) {
    return family.neighborhood
      ? { kind: 'neighborhood', area: family.generalArea, neighborhood: family.neighborhood }
      : { kind: 'area', area: family.generalArea };
  }

  switch (family.privacy.location) {
    case 'hidden':
      return { kind: 'hidden' };
    case 'general_area':
      return { kind: 'area', area: family.generalArea };
    case 'neighborhood':
      // Neighbourhood is finer-grained, so it is held back until families connect.
      return tier >= DisclosureTier.CONNECTED && family.neighborhood
        ? { kind: 'neighborhood', area: family.generalArea, neighborhood: family.neighborhood }
        : { kind: 'area', area: family.generalArea };
    case 'approximate_distance':
      return distanceKm === undefined
        ? { kind: 'area', area: family.generalArea }
        : { kind: 'distance', bandKey: distanceBandKey(distanceKm) };
    default:
      return { kind: 'area', area: family.generalArea };
  }
}

/**
 * Child display name, honouring the parent's choice. Never a surname, ever.
 *
 * Returns a placeholder marker rather than the string "Child 1" when the name is
 * hidden, so the UI can render it in the reader's language.
 */
export function childDisplayName(
  child: Child,
  family: Family,
  index: number,
  tier: DisclosureTier,
): string | { placeholderIndex: number } {
  const placeholder = { placeholderIndex: index + 1 };
  if (tier === DisclosureTier.SELF) {
    return child.nickname ? `${child.firstName} (${child.nickname})` : child.firstName;
  }

  switch (family.privacy.childName) {
    case 'hidden':
      return placeholder;
    case 'nickname':
      return child.nickname || placeholder;
    case 'first_name':
      return child.firstName;
    default:
      return placeholder;
  }
}

/** Age view: exact, or a ±1 band when the parent chose range disclosure. */
export function childAgeView(child: Child, family: Family, tier: DisclosureTier): AgeDisclosureView {
  if (tier === DisclosureTier.SELF || family.privacy.childAges === 'exact') {
    return { kind: 'exact', age: child.age };
  }
  return { kind: 'range', from: Math.max(1, child.age - 1), to: child.age + 1 };
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
    ageView: childAgeView(child, family, tier),
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
    location: locationView(family, tier, distanceKm),
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
    distanceBandKey: distanceKm === undefined ? undefined : distanceBandKey(distanceKm),
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
