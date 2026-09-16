import type { AvailabilitySlot, Child, DayOfWeek, Family, Importance, TimeBlock } from '../../src/domain/types';
import { sanitiseText, validateChildAge, validateLength, validateRequired } from '../../src/domain/validation';
import { assertOwnFamily } from '../../src/services/security/guards';
import { sql } from '../db/client';
import {
  createFamily as insertFamily,
  deleteChild,
  familyIdForChild,
  insertChild,
  loadFamily,
  replaceAvailability,
  replaceChildInterests,
  updateChildRow,
  updateFamilyProfile,
  updatePreferences as writePreferences,
  updatePrivacy as writePrivacy,
} from '../db/repos/families';
import { bindFamilyToSessions } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { BadRequestError, ForbiddenError, NotFoundError } from '../http/errors';
import { arr, bool, literal, num, obj, optionalBool, optionalLiteral, optionalNum, optionalObj, optionalStr, str, strArr } from './input';

const DAYS: readonly DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const BLOCKS: readonly TimeBlock[] = ['morning', 'afternoon', 'evening'];
const STYLES = [
  'parents_stay',
  'drop_off_ok',
  'public_places_only',
  'home_visits_ok',
  'small_groups',
  'structured_activities',
] as const;

/**
 * Family profile, preferences, availability and privacy.
 *
 * Every write re-reads the family and returns the whole aggregate, matching the
 * contract the UI already expects. That costs a round trip and buys the
 * guarantee that the client's copy is never a guess about what the server did
 * with a partial update.
 */

export async function createFamily(ctx: RequestContext): Promise<Family> {
  const { session, account } = await ctx.requireAccount();
  if (session.familyId) {
    throw new BadRequestError('You already have a family profile.', undefined, 'family_exists');
  }

  const displayName = sanitiseText(str(ctx.body, 'displayName', { max: 80 }), 80);
  const generalArea = sanitiseText(str(ctx.body, 'generalArea', { max: 80 }), 80);
  const neighborhood = optionalStr(ctx.body, 'neighborhood', { max: 80 });
  const about = optionalStr(ctx.body, 'about', { max: 600 });
  const languages = strArr(ctx.body, 'languages', 10).map((l) => sanitiseText(l, 40));

  for (const [error, field] of [
    [validateRequired(displayName, 'ob.fam.name'), 'displayName'],
    [validateRequired(generalArea, 'ob.fam.area'), 'generalArea'],
  ] as const) {
    if (error) throw new BadRequestError(error.key, field, error.key);
  }

  // Coordinates are NOT taken from the client. A browser-supplied lat/lng is
  // both untrusted and unnecessarily precise; production geocodes the coarse
  // area label server-side and stores the centroid of that area, never of a
  // street address. Until that service is wired, this is a zero centroid and
  // distance scoring degrades gracefully to "unknown" rather than lying.
  const approxLocation = { lat: 0, lng: 0 };

  const familyId = await insertFamily({
    parentId: session.parentId,
    displayName,
    generalArea,
    neighborhood,
    about,
    languages,
    approxLocation,
    verificationStatus: 'unstarted',
    accountState: account.state,
  });

  await bindFamilyToSessions(session.accountId, familyId);
  await ctx.audit({ action: 'family.created', target: familyId });

  const family = await loadFamily(familyId);
  if (!family) throw new NotFoundError('Family could not be loaded after creation.');
  return family;
}

export async function getMyFamily(ctx: RequestContext): Promise<Family | null> {
  const session = ctx.requireSession();
  if (!session.familyId) return null;
  return loadFamily(session.familyId);
}

export async function updateProfile(ctx: RequestContext): Promise<Family> {
  const { session, family } = await ctx.requireFamily();
  assertOwnFamily(session, family.id);

  const displayName = optionalStr(ctx.body, 'displayName', { max: 80 });
  const generalArea = optionalStr(ctx.body, 'generalArea', { max: 80 });
  const neighborhood = optionalStr(ctx.body, 'neighborhood', { max: 80 });
  const about = optionalStr(ctx.body, 'about', { max: 600 });
  const languages = ctx.body.languages === undefined ? undefined : strArr(ctx.body, 'languages', 10);

  if (about !== undefined) {
    const error = validateLength(about, 'ob.fam.about', 0, 600);
    if (error) throw new BadRequestError(error.key, 'about', error.key);
  }

  await updateFamilyProfile(family.id, {
    displayName: displayName === undefined ? undefined : sanitiseText(displayName, 80),
    generalArea: generalArea === undefined ? undefined : sanitiseText(generalArea, 80),
    neighborhood: neighborhood === undefined ? undefined : sanitiseText(neighborhood, 80),
    about: about === undefined ? undefined : sanitiseText(about, 600),
    languages: languages?.map((l) => sanitiseText(l, 40)),
  });

  await ctx.audit({ action: 'family.profile_updated', target: family.id });
  return (await loadFamily(family.id)) as Family;
}

export async function updatePreferences(ctx: RequestContext): Promise<Family> {
  const { family } = await ctx.requireFamily();
  const current = family.preferences;
  const weightsInput = optionalObj(ctx.body, 'weights');

  const next = {
    maxTravelKm: optionalNum(ctx.body, 'maxTravelKm', 1, 100) ?? current.maxTravelKm,
    ageFlexibilityYears: optionalNum(ctx.body, 'ageFlexibilityYears', 0, 6) ?? current.ageFlexibilityYears,
    weights: {
      interests: weight(weightsInput, 'interests', current.weights.interests),
      age: weight(weightsInput, 'age', current.weights.age),
      distance: weight(weightsInput, 'distance', current.weights.distance),
      availability: weight(weightsInput, 'availability', current.weights.availability),
      style: weight(weightsInput, 'style', current.weights.style),
    },
    styles:
      ctx.body.styles === undefined
        ? current.styles
        : arr(ctx.body, 'styles', 10).map((v, i) => {
            if (typeof v !== 'string' || !STYLES.includes(v as (typeof STYLES)[number])) {
              throw new BadRequestError(`styles[${i}] is not a known playdate style.`, 'styles');
            }
            return v as (typeof STYLES)[number];
          }),
    preferredActivities:
      ctx.body.preferredActivities === undefined
        ? current.preferredActivities
        : strArr(ctx.body, 'preferredActivities', 20).map((a) => sanitiseText(a, 40)),
  };

  await writePreferences(family.id, next);
  await ctx.audit({ action: 'family.preferences_updated', target: family.id });
  return (await loadFamily(family.id)) as Family;
}

function weight(input: Record<string, unknown> | undefined, key: string, fallback: Importance): Importance {
  if (!input || input[key] === undefined) return fallback;
  const value = input[key];
  if (typeof value !== 'number' || ![1, 2, 3, 4, 5].includes(value)) {
    throw new BadRequestError(`weights.${key} must be between 1 and 5.`, 'weights');
  }
  return value as Importance;
}

export async function updateAvailability(ctx: RequestContext): Promise<Family> {
  const { family } = await ctx.requireFamily();

  const slots = arr(ctx.body, 'slots', 21).map((raw, i): AvailabilitySlot => {
    if (raw === null || typeof raw !== 'object') {
      throw new BadRequestError(`slots[${i}] must be an object.`, 'slots');
    }
    const s = raw as Record<string, unknown>;
    return { day: literal(s, 'day', DAYS), block: literal(s, 'block', BLOCKS) };
  });

  await replaceAvailability(family.id, slots);
  await ctx.audit({ action: 'family.availability_updated', target: family.id });
  return (await loadFamily(family.id)) as Family;
}

export async function updatePrivacy(ctx: RequestContext): Promise<Family> {
  const { family } = await ctx.requireFamily();
  const current = family.privacy;

  const next = {
    location:
      optionalLiteral(ctx.body, 'location', ['hidden', 'general_area', 'neighborhood', 'approximate_distance'] as const) ??
      current.location,
    childName: optionalLiteral(ctx.body, 'childName', ['hidden', 'first_name', 'nickname'] as const) ?? current.childName,
    childPhotos:
      optionalLiteral(ctx.body, 'childPhotos', ['hidden', 'on_request', 'connected_families'] as const) ??
      current.childPhotos,
    childAges: optionalLiteral(ctx.body, 'childAges', ['exact', 'range'] as const) ?? current.childAges,
    discoverable: optionalBool(ctx.body, 'discoverable') ?? current.discoverable,
    availabilityDetail:
      optionalLiteral(ctx.body, 'availabilityDetail', ['summary', 'detailed'] as const) ?? current.availabilityDetail,
    parentBio: optionalLiteral(ctx.body, 'parentBio', ['connected_only', 'discovery'] as const) ?? current.parentBio,
    requireVerifiedToRequest: optionalBool(ctx.body, 'requireVerifiedToRequest') ?? current.requireVerifiedToRequest,
  };

  await writePrivacy(family.id, next);
  // Privacy changes are audited by name: if a parent ever asks "who made my
  // family discoverable", the answer has to exist.
  await ctx.audit({
    action: 'family.privacy_updated',
    target: family.id,
    metadata: { discoverable: next.discoverable, location: next.location, childName: next.childName },
  });
  return (await loadFamily(family.id)) as Family;
}

export async function acceptSafetyGuidelines(ctx: RequestContext): Promise<null> {
  const session = ctx.requireSession();
  await sql`UPDATE accounts SET safety_guidelines_accepted_at = now() WHERE id = ${session.accountId}`;
  await ctx.audit({ action: 'safety.guidelines_accepted' });
  return null;
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

const PALETTE = ['#7C6BF0', '#E8804A', '#3FA796', '#D8567E', '#4A7FC1', '#B4763D'];

export async function addChild(ctx: RequestContext): Promise<Child> {
  const { family } = await ctx.requireFamily();
  if (family.children.length >= 12) {
    throw new BadRequestError('You have reached the maximum number of children.', undefined, 'too_many_children');
  }

  const input = readChildInput(ctx.body, { requireAll: true });
  const childId = await insertChild(family.id, {
    firstName: input.firstName as string,
    nickname: input.nickname,
    age: input.age as number,
    pronouns: input.pronouns,
    notes: input.notes,
    temperament: input.temperament,
    interests: input.interests ?? [],
    avatarColor: PALETTE[family.children.length % PALETTE.length] as string,
  });

  await ctx.audit({ action: 'child.added', target: family.id });

  const updated = await loadFamily(family.id);
  const child = updated?.children.find((c) => c.id === childId);
  if (!child) throw new NotFoundError('Child could not be loaded after creation.');
  return child;
}

export async function updateChild(ctx: RequestContext): Promise<Child> {
  const { family } = await ctx.requireFamily();
  const childId = str(ctx.body, 'childId');

  // Ownership is checked against the database, not against the id in the body.
  const owner = await familyIdForChild(childId);
  if (owner !== family.id) {
    throw new ForbiddenError('You can only change your own children.', 'not_your_child');
  }

  const input = readChildInput(ctx.body, { requireAll: false });
  await updateChildRow(childId, {
    firstName: input.firstName,
    nickname: input.nickname,
    age: input.age,
    pronouns: input.pronouns,
    notes: input.notes,
    temperament: input.temperament,
  });
  if (input.interests) await replaceChildInterests(childId, input.interests);

  await ctx.audit({ action: 'child.updated', target: family.id });

  const updated = await loadFamily(family.id);
  const child = updated?.children.find((c) => c.id === childId);
  if (!child) throw new NotFoundError('Child not found.');
  return child;
}

export async function removeChild(ctx: RequestContext): Promise<null> {
  const { family } = await ctx.requireFamily();
  const childId = str(ctx.body, 'childId');

  const owner = await familyIdForChild(childId);
  if (owner !== family.id) {
    throw new ForbiddenError('You can only remove your own children.', 'not_your_child');
  }

  await deleteChild(childId);
  await ctx.audit({ action: 'child.removed', target: family.id });
  return null;
}

interface ChildFields {
  firstName?: string;
  nickname?: string;
  age?: number;
  pronouns?: string;
  notes?: string;
  temperament?: { energy: Importance; sociability: Importance };
  interests?: Array<{ interestId: string; enthusiasm: Importance; importance: Importance }>;
}

function readChildInput(body: Record<string, unknown>, opts: { requireAll: boolean }): ChildFields {
  const firstName = opts.requireAll
    ? sanitiseText(str(body, 'firstName', { max: 40 }), 40)
    : optionalStr(body, 'firstName', { max: 40 });

  if (firstName !== undefined) {
    const error = validateRequired(firstName, 'ob.kids.firstName');
    if (error) throw new BadRequestError(error.key, 'firstName', error.key);
  }

  const age = opts.requireAll ? num(body, 'age', 0, 18) : optionalNum(body, 'age', 0, 18);
  if (age !== undefined) {
    const error = validateChildAge(age);
    if (error) throw new BadRequestError(error.key, 'age', error.key);
  }

  const temperamentRaw = optionalObj(body, 'temperament');
  const temperament = temperamentRaw
    ? {
        energy: num(temperamentRaw, 'energy', 1, 5) as Importance,
        sociability: num(temperamentRaw, 'sociability', 1, 5) as Importance,
      }
    : undefined;

  const interestsRaw = body.interests === undefined ? undefined : arr(body, 'interests', 40);
  const interests = interestsRaw?.map((raw, i) => {
    if (raw === null || typeof raw !== 'object') {
      throw new BadRequestError(`interests[${i}] must be an object.`, 'interests');
    }
    const item = raw as Record<string, unknown>;
    return {
      interestId: str(item, 'interestId', { max: 60 }),
      enthusiasm: num(item, 'enthusiasm', 1, 5) as Importance,
      importance: num(item, 'importance', 1, 5) as Importance,
    };
  });

  const nickname = optionalStr(body, 'nickname', { max: 40 });
  const pronouns = optionalStr(body, 'pronouns', { max: 20 });
  const notes = optionalStr(body, 'notes', { max: 400 });

  const fields: ChildFields = {};
  if (firstName !== undefined) fields.firstName = firstName;
  if (nickname !== undefined) fields.nickname = sanitiseText(nickname, 40);
  if (age !== undefined) fields.age = age;
  if (pronouns !== undefined) fields.pronouns = sanitiseText(pronouns, 20);
  if (notes !== undefined) fields.notes = sanitiseText(notes, 400);
  if (temperament) fields.temperament = temperament;
  if (interests) fields.interests = interests;
  return fields;
}

export { bool, obj };
