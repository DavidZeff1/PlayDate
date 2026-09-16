import type {
  AvailabilitySlot,
  Child,
  ChildInterest,
  DayOfWeek,
  Family,
  FamilyPreferences,
  Importance,
  PlaydateStyle,
  PrivacySettings,
  TimeBlock,
} from '../../../src/domain/types';
import { sql, newId } from '../client';

/**
 * Families and children.
 *
 * `loadFamily` assembles the full aggregate — preferences, privacy,
 * availability, children, interests — because the matching engine takes a whole
 * `Family` and it is the same function on both sides of the wire. That is five
 * queries; `loadFamiliesForDiscovery` does the same work set-at-a-time for the
 * candidate pool, because doing it per-candidate would be N+1 against a table
 * that grows with the city.
 */

interface FamilyRow {
  id: string;
  display_name: string;
  general_area: string;
  neighborhood: string | null;
  approx_lat: number;
  approx_lng: number;
  about: string | null;
  languages: string[];
  created_at: Date;
  verification_status: Family['verificationStatus'];
  account_state: Family['accountState'];
}

interface PrefRow {
  family_id: string;
  max_travel_km: number;
  age_flexibility_years: number;
  w_interests: number;
  w_age: number;
  w_distance: number;
  w_availability: number;
  w_style: number;
  styles: string[];
  preferred_activities: string[];
}

interface PrivacyRow {
  family_id: string;
  location: PrivacySettings['location'];
  child_name: PrivacySettings['childName'];
  child_photos: PrivacySettings['childPhotos'];
  child_ages: PrivacySettings['childAges'];
  discoverable: boolean;
  availability_detail: PrivacySettings['availabilityDetail'];
  parent_bio: PrivacySettings['parentBio'];
  require_verified_to_request: boolean;
}

interface ChildRow {
  id: string;
  family_id: string;
  first_name: string;
  nickname: string | null;
  age: number;
  pronouns: string | null;
  notes: string | null;
  energy: number | null;
  sociability: number | null;
  avatar_color: string;
  photo_ref: string | null;
}

interface InterestRow {
  child_id: string;
  interest_id: string;
  enthusiasm: number;
  importance: number;
}

interface SlotRow {
  family_id: string;
  day: DayOfWeek;
  block: TimeBlock;
}

const DEFAULT_PREFS: FamilyPreferences = {
  maxTravelKm: 10,
  ageFlexibilityYears: 2,
  weights: { interests: 4, age: 4, distance: 3, availability: 3, style: 3 },
  styles: [],
  preferredActivities: [],
};

const DEFAULT_PRIVACY: PrivacySettings = {
  location: 'general_area',
  childName: 'first_name',
  childPhotos: 'hidden',
  childAges: 'exact',
  discoverable: true,
  availabilityDetail: 'summary',
  parentBio: 'connected_only',
  requireVerifiedToRequest: true,
};

function toPrefs(row: PrefRow | undefined): FamilyPreferences {
  if (!row) return DEFAULT_PREFS;
  return {
    maxTravelKm: row.max_travel_km,
    ageFlexibilityYears: row.age_flexibility_years,
    weights: {
      interests: row.w_interests as Importance,
      age: row.w_age as Importance,
      distance: row.w_distance as Importance,
      availability: row.w_availability as Importance,
      style: row.w_style as Importance,
    },
    styles: row.styles as PlaydateStyle[],
    preferredActivities: row.preferred_activities,
  };
}

function toPrivacy(row: PrivacyRow | undefined): PrivacySettings {
  if (!row) return DEFAULT_PRIVACY;
  return {
    location: row.location,
    childName: row.child_name,
    childPhotos: row.child_photos,
    childAges: row.child_ages,
    discoverable: row.discoverable,
    availabilityDetail: row.availability_detail,
    parentBio: row.parent_bio,
    requireVerifiedToRequest: row.require_verified_to_request,
  };
}

function toChild(row: ChildRow, interests: InterestRow[]): Child {
  const child: Child = {
    id: row.id,
    familyId: row.family_id,
    firstName: row.first_name,
    age: row.age,
    avatarColor: row.avatar_color,
    interests: interests.map(
      (i): ChildInterest => ({
        interestId: i.interest_id,
        enthusiasm: i.enthusiasm as Importance,
        importance: i.importance as Importance,
      }),
    ),
  };
  if (row.nickname) child.nickname = row.nickname;
  if (row.pronouns) child.pronouns = row.pronouns;
  if (row.notes) child.notes = row.notes;
  if (row.photo_ref) child.photoRef = row.photo_ref;
  if (row.energy !== null && row.sociability !== null) {
    child.temperament = { energy: row.energy as Importance, sociability: row.sociability as Importance };
  }
  return child;
}

function assemble(
  row: FamilyRow,
  prefs: PrefRow | undefined,
  privacy: PrivacyRow | undefined,
  slots: SlotRow[],
  children: ChildRow[],
  interests: InterestRow[],
): Family {
  const byChild = new Map<string, InterestRow[]>();
  for (const i of interests) {
    const list = byChild.get(i.child_id) ?? [];
    list.push(i);
    byChild.set(i.child_id, list);
  }

  const family: Family = {
    id: row.id,
    displayName: row.display_name,
    generalArea: row.general_area,
    approxLocation: { lat: Number(row.approx_lat), lng: Number(row.approx_lng) },
    children: children.map((c) => toChild(c, byChild.get(c.id) ?? [])),
    preferences: toPrefs(prefs),
    availability: slots.map((s): AvailabilitySlot => ({ day: s.day, block: s.block })),
    privacy: toPrivacy(privacy),
    createdAt: new Date(row.created_at).toISOString(),
    verificationStatus: row.verification_status,
    accountState: row.account_state,
    languages: row.languages,
  };
  if (row.neighborhood) family.neighborhood = row.neighborhood;
  if (row.about) family.about = row.about;
  return family;
}

export async function loadFamily(familyId: string): Promise<Family | null> {
  const rows = (await sql`
    SELECT * FROM families WHERE id = ${familyId} AND deleted_at IS NULL LIMIT 1
  `) as unknown as FamilyRow[];
  const row = rows[0];
  if (!row) return null;

  const [prefs, privacy, slots, children] = await Promise.all([
    sql`SELECT * FROM family_preferences WHERE family_id = ${familyId}` as unknown as Promise<PrefRow[]>,
    sql`SELECT * FROM family_privacy WHERE family_id = ${familyId}` as unknown as Promise<PrivacyRow[]>,
    sql`SELECT * FROM family_availability WHERE family_id = ${familyId}` as unknown as Promise<SlotRow[]>,
    sql`SELECT * FROM children WHERE family_id = ${familyId} ORDER BY sort_order, created_at` as unknown as Promise<
      ChildRow[]
    >,
  ]);

  const childIds = children.map((c) => c.id);
  const interests = childIds.length
    ? ((await sql`SELECT * FROM child_interests WHERE child_id = ANY(${childIds})`) as unknown as InterestRow[])
    : [];

  return assemble(row, prefs[0], privacy[0], slots, children, interests);
}

/**
 * The candidate pool for discovery.
 *
 * Excludes, in the query rather than in application code: the viewer's own
 * family, soft-deleted families, families that have switched discovery off,
 * seeded demo families, and any account not in good standing. A filter that
 * lives in the WHERE clause cannot be forgotten by a later caller.
 *
 * Note what is NOT selected anywhere in this function: precise_lat/lng,
 * home_address, legal names, dates of birth. The distance calculation uses
 * families.approx_lat/lng — a deliberately coarse centroid — and the result
 * leaves the server only as a band.
 */
export async function loadFamiliesForDiscovery(viewerFamilyId: string): Promise<Family[]> {
  const rows = (await sql`
    SELECT f.*
      FROM families f
      JOIN family_privacy p ON p.family_id = f.id
     WHERE f.id <> ${viewerFamilyId}
       AND f.deleted_at IS NULL
       AND f.is_demo = FALSE
       AND p.discoverable = TRUE
       AND f.account_state IN ('active', 'verification_required')
     LIMIT 500
  `) as unknown as FamilyRow[];

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [prefs, privacy, slots, children] = await Promise.all([
    sql`SELECT * FROM family_preferences WHERE family_id = ANY(${ids})` as unknown as Promise<PrefRow[]>,
    sql`SELECT * FROM family_privacy WHERE family_id = ANY(${ids})` as unknown as Promise<PrivacyRow[]>,
    sql`SELECT * FROM family_availability WHERE family_id = ANY(${ids})` as unknown as Promise<SlotRow[]>,
    sql`SELECT * FROM children WHERE family_id = ANY(${ids}) ORDER BY sort_order, created_at` as unknown as Promise<
      ChildRow[]
    >,
  ]);

  const childIds = children.map((c) => c.id);
  const interests = childIds.length
    ? ((await sql`SELECT * FROM child_interests WHERE child_id = ANY(${childIds})`) as unknown as InterestRow[])
    : [];

  const prefBy = new Map(prefs.map((p) => [p.family_id, p]));
  const privBy = new Map(privacy.map((p) => [p.family_id, p]));
  const slotsBy = new Map<string, SlotRow[]>();
  for (const s of slots) slotsBy.set(s.family_id, [...(slotsBy.get(s.family_id) ?? []), s]);
  const kidsBy = new Map<string, ChildRow[]>();
  for (const c of children) kidsBy.set(c.family_id, [...(kidsBy.get(c.family_id) ?? []), c]);

  return rows.map((r) =>
    assemble(r, prefBy.get(r.id), privBy.get(r.id), slotsBy.get(r.id) ?? [], kidsBy.get(r.id) ?? [], interests),
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createFamily(input: {
  parentId: string;
  displayName: string;
  generalArea: string;
  neighborhood?: string;
  about?: string;
  languages: string[];
  approxLocation: { lat: number; lng: number };
  verificationStatus: Family['verificationStatus'];
  accountState: Family['accountState'];
}): Promise<string> {
  const familyId = newId('fam');

  await sql`
    INSERT INTO families (
      id, display_name, general_area, neighborhood, about, languages,
      approx_lat, approx_lng, verification_status, account_state
    ) VALUES (
      ${familyId}, ${input.displayName}, ${input.generalArea}, ${input.neighborhood ?? null},
      ${input.about ?? null}, ${input.languages}, ${input.approxLocation.lat},
      ${input.approxLocation.lng}, ${input.verificationStatus}, ${input.accountState}
    )
  `;
  await sql`INSERT INTO family_preferences (family_id) VALUES (${familyId})`;
  await sql`INSERT INTO family_privacy (family_id) VALUES (${familyId})`;
  await sql`
    INSERT INTO family_memberships (parent_id, family_id, role)
    VALUES (${input.parentId}, ${familyId}, 'primary')
  `;

  return familyId;
}

export async function updateFamilyProfile(
  familyId: string,
  patch: { displayName?: string; generalArea?: string; neighborhood?: string; about?: string; languages?: string[] },
): Promise<void> {
  await sql`
    UPDATE families
       SET display_name = COALESCE(${patch.displayName ?? null}, display_name),
           general_area = COALESCE(${patch.generalArea ?? null}, general_area),
           neighborhood = COALESCE(${patch.neighborhood ?? null}, neighborhood),
           about        = COALESCE(${patch.about ?? null}, about),
           languages    = COALESCE(${patch.languages ?? null}, languages)
     WHERE id = ${familyId}
  `;
}

export async function updatePreferences(familyId: string, prefs: FamilyPreferences): Promise<void> {
  await sql`
    UPDATE family_preferences
       SET max_travel_km = ${prefs.maxTravelKm},
           age_flexibility_years = ${prefs.ageFlexibilityYears},
           w_interests = ${prefs.weights.interests},
           w_age = ${prefs.weights.age},
           w_distance = ${prefs.weights.distance},
           w_availability = ${prefs.weights.availability},
           w_style = ${prefs.weights.style},
           styles = ${prefs.styles},
           preferred_activities = ${prefs.preferredActivities}
     WHERE family_id = ${familyId}
  `;
}

export async function updatePrivacy(familyId: string, privacy: PrivacySettings): Promise<void> {
  await sql`
    UPDATE family_privacy
       SET location = ${privacy.location},
           child_name = ${privacy.childName},
           child_photos = ${privacy.childPhotos},
           child_ages = ${privacy.childAges},
           discoverable = ${privacy.discoverable},
           availability_detail = ${privacy.availabilityDetail},
           parent_bio = ${privacy.parentBio},
           require_verified_to_request = ${privacy.requireVerifiedToRequest}
     WHERE family_id = ${familyId}
  `;
}

export async function replaceAvailability(familyId: string, slots: AvailabilitySlot[]): Promise<void> {
  await sql`DELETE FROM family_availability WHERE family_id = ${familyId}`;
  for (const slot of slots) {
    await sql`
      INSERT INTO family_availability (family_id, day, block)
      VALUES (${familyId}, ${slot.day}, ${slot.block})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function setFamilyVerification(
  familyId: string,
  status: Family['verificationStatus'],
): Promise<void> {
  await sql`UPDATE families SET verification_status = ${status} WHERE id = ${familyId}`;
}

export async function setFamilyAccountState(
  familyId: string,
  state: Family['accountState'],
): Promise<void> {
  await sql`UPDATE families SET account_state = ${state} WHERE id = ${familyId}`;
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

export async function insertChild(
  familyId: string,
  input: {
    firstName: string;
    nickname?: string;
    age: number;
    pronouns?: string;
    notes?: string;
    temperament?: { energy: Importance; sociability: Importance };
    interests: ChildInterest[];
    avatarColor: string;
  },
): Promise<string> {
  const childId = newId('chi');
  await sql`
    INSERT INTO children (id, family_id, first_name, nickname, age, pronouns, notes, energy, sociability, avatar_color)
    VALUES (
      ${childId}, ${familyId}, ${input.firstName}, ${input.nickname ?? null}, ${input.age},
      ${input.pronouns ?? null}, ${input.notes ?? null}, ${input.temperament?.energy ?? null},
      ${input.temperament?.sociability ?? null}, ${input.avatarColor}
    )
  `;
  await replaceChildInterests(childId, input.interests);
  return childId;
}

export async function updateChildRow(
  childId: string,
  patch: {
    firstName?: string;
    nickname?: string;
    age?: number;
    pronouns?: string;
    notes?: string;
    temperament?: { energy: Importance; sociability: Importance };
  },
): Promise<void> {
  await sql`
    UPDATE children
       SET first_name  = COALESCE(${patch.firstName ?? null}, first_name),
           nickname    = COALESCE(${patch.nickname ?? null}, nickname),
           age         = COALESCE(${patch.age ?? null}, age),
           pronouns    = COALESCE(${patch.pronouns ?? null}, pronouns),
           notes       = COALESCE(${patch.notes ?? null}, notes),
           energy      = COALESCE(${patch.temperament?.energy ?? null}, energy),
           sociability = COALESCE(${patch.temperament?.sociability ?? null}, sociability)
     WHERE id = ${childId}
  `;
}

export async function replaceChildInterests(childId: string, interests: ChildInterest[]): Promise<void> {
  await sql`DELETE FROM child_interests WHERE child_id = ${childId}`;
  for (const i of interests) {
    await sql`
      INSERT INTO child_interests (child_id, interest_id, enthusiasm, importance)
      VALUES (${childId}, ${i.interestId}, ${i.enthusiasm}, ${i.importance})
      ON CONFLICT (child_id, interest_id) DO UPDATE
        SET enthusiasm = EXCLUDED.enthusiasm, importance = EXCLUDED.importance
    `;
  }
}

/** Ownership check. Returns the family id so the caller can compare it to the session. */
export async function familyIdForChild(childId: string): Promise<string | null> {
  const rows = (await sql`SELECT family_id FROM children WHERE id = ${childId} LIMIT 1`) as unknown as Array<{
    family_id: string;
  }>;
  return rows[0]?.family_id ?? null;
}

export async function deleteChild(childId: string): Promise<void> {
  await sql`DELETE FROM children WHERE id = ${childId}`;
}
