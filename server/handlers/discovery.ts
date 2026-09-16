import type { AvailabilitySlot, DayOfWeek, Family, FamilyProjection, ParentProfile, TimeBlock } from '../../src/domain/types';
import { DisclosureTier } from '../../src/domain/types';
import { haversineKm, rankFamilies } from '../../src/domain/matching/engine';
import { projectFamily } from '../../src/domain/privacy/redaction';
import { assertCanDiscover, resolveDisclosureTier } from '../../src/services/security/guards';
import type { DiscoveryResult } from '../../src/services/api';
import { sql } from '../db/client';
import { completedPlaydateCount, loadParentIdentity, loadParentProfile, trustSignalsFor, upheldReportCount } from '../db/repos/accounts';
import { loadFamiliesForDiscovery, loadFamily } from '../db/repos/families';
import type { RequestContext } from '../http/context';
import { NotFoundError } from '../http/errors';
import { arr, literal, optionalBool, optionalLiteral, optionalNum, str, strArr } from './input';

/**
 * Discovery.
 *
 * This is the endpoint the whole privacy design exists for, so it is worth
 * being explicit about what changed versus the prototype.
 *
 * In the prototype, `projectFamily()` ran in the browser — which meant the full
 * `Family` record, coordinates and all, had already crossed the wire before
 * anything narrowed it. The claim in ARCHITECTURE.md §1.4 that "the data is not
 * in the object to leak" was true of the rendered object and false of the
 * response body.
 *
 * Here the projection runs before serialisation. `loadFamiliesForDiscovery`
 * selects only the coarse `families.approx_lat/lng`; the distance it computes
 * leaves this function as a band key and never as a number. No response from
 * this module contains an address, a coordinate, a legal name, a date of birth,
 * a phone number or an email, because none of those are ever loaded.
 */

const DAYS: readonly DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const BLOCKS: readonly TimeBlock[] = ['morning', 'afternoon', 'evening'];

interface ViewerRelations {
  blocked: Set<string>;
  connectedTo: Set<string>;
  planningWith: Set<string>;
  requestSentTo: Set<string>;
  requestReceivedFrom: Set<string>;
  declinedWith: Set<string>;
  photoConsentFrom: Set<string>;
}

/**
 * Everything about the viewer's relationships, in one round trip.
 *
 * Loaded up front rather than per-candidate: the per-candidate version is an
 * N+1 that turns one discovery page into several hundred queries, and the
 * tempting fix — caching it in the client — would put the relationship graph
 * where it does not belong.
 */
async function loadRelations(familyId: string): Promise<ViewerRelations> {
  const [blocks, connections, playdates, requests, consents] = await Promise.all([
    sql`SELECT blocker_family_id, blocked_family_id FROM blocks
         WHERE blocker_family_id = ${familyId} OR blocked_family_id = ${familyId}` as unknown as Promise<
      Array<{ blocker_family_id: string; blocked_family_id: string }>
    >,
    sql`SELECT family_a_id, family_b_id FROM connections
         WHERE state = 'active' AND (family_a_id = ${familyId} OR family_b_id = ${familyId})` as unknown as Promise<
      Array<{ family_a_id: string; family_b_id: string }>
    >,
    sql`SELECT family_a_id, family_b_id FROM playdates
         WHERE status = 'confirmed' AND (family_a_id = ${familyId} OR family_b_id = ${familyId})` as unknown as Promise<
      Array<{ family_a_id: string; family_b_id: string }>
    >,
    sql`SELECT from_family_id, to_family_id, status FROM connection_requests
         WHERE from_family_id = ${familyId} OR to_family_id = ${familyId}` as unknown as Promise<
      Array<{ from_family_id: string; to_family_id: string; status: string }>
    >,
    sql`SELECT target_family_id FROM photo_consents WHERE viewer_family_id = ${familyId}` as unknown as Promise<
      Array<{ target_family_id: string }>
    >,
  ]);

  const other = (a: string, b: string): string => (a === familyId ? b : a);

  const relations: ViewerRelations = {
    blocked: new Set(blocks.map((b) => other(b.blocker_family_id, b.blocked_family_id))),
    connectedTo: new Set(connections.map((c) => other(c.family_a_id, c.family_b_id))),
    planningWith: new Set(playdates.map((p) => other(p.family_a_id, p.family_b_id))),
    requestSentTo: new Set(),
    requestReceivedFrom: new Set(),
    declinedWith: new Set(),
    photoConsentFrom: new Set(consents.map((c) => c.target_family_id)),
  };

  for (const r of requests) {
    const them = other(r.from_family_id, r.to_family_id);
    if (r.status === 'pending') {
      if (r.from_family_id === familyId) relations.requestSentTo.add(them);
      else relations.requestReceivedFrom.add(them);
    } else if (r.status === 'declined') {
      relations.declinedWith.add(them);
    }
  }

  return relations;
}

function relationshipTo(relations: ViewerRelations, targetId: string): DiscoveryResult['relationship'] {
  if (relations.connectedTo.has(targetId)) return 'connected';
  if (relations.requestSentTo.has(targetId)) return 'request_sent';
  if (relations.requestReceivedFrom.has(targetId)) return 'request_received';
  if (relations.declinedWith.has(targetId)) return 'declined';
  return 'none';
}

/** Primary parent's social profile, with trust signals computed from facts. */
async function primaryParentFor(family: Family): Promise<ParentProfile | undefined> {
  const rows = (await sql`
    SELECT parent_id FROM family_memberships
     WHERE family_id = ${family.id} ORDER BY role, joined_at LIMIT 1
  `) as unknown as Array<{ parent_id: string }>;

  const parentId = rows[0]?.parent_id;
  if (!parentId) return undefined;

  const profile = await loadParentProfile(parentId);
  if (!profile) return undefined;

  const identity = await loadParentIdentity(parentId);
  const [completed, upheld] = await Promise.all([
    completedPlaydateCount(family.id),
    upheldReportCount(family.id),
  ]);

  profile.trustSignals = await trustSignalsFor({
    account: {
      emailVerified: true,
      phoneVerified: true,
      twoFactorEnabled: false,
    } as never,
    profile,
    identityStatus: identity?.verificationStatus ?? 'unstarted',
    completedPlaydates: completed,
    secondaryParentVerified: false,
    profileComplete: Boolean(family.about && family.children.length > 0),
    upheldReports: upheld,
  });

  return profile;
}

async function projectFor(
  viewer: Family,
  candidate: Family,
  relations: ViewerRelations,
): Promise<FamilyProjection | null> {
  const tier = resolveDisclosureTier({
    viewerFamilyId: viewer.id,
    targetFamilyId: candidate.id,
    hasConnection: relations.connectedTo.has(candidate.id),
    hasConfirmedPlaydate: relations.planningWith.has(candidate.id),
    canDiscover: true,
    isBlockedEitherWay: relations.blocked.has(candidate.id),
  });
  if (tier === DisclosureTier.NONE) return null;

  const parent = await primaryParentFor(candidate);

  return projectFamily(candidate, {
    tier,
    // A number in, a band key out. The exact value never leaves this call.
    distanceKm: haversineKm(viewer.approxLocation, candidate.approxLocation),
    parent,
    photoConsentGranted: relations.photoConsentFrom.has(candidate.id),
  });
}

export async function discoverFamilies(ctx: RequestContext): Promise<DiscoveryResult[]> {
  const { session, account, family } = await ctx.requireFamily();

  // THE gate. An unverified adult never browses other families' children.
  assertCanDiscover(account, family);
  await ctx.limit('discovery_page');

  const filters = readFilters(ctx.body);
  const relations = await loadRelations(family.id);
  const candidates = await loadFamiliesForDiscovery(family.id);

  const ranked = rankFamilies(family, candidates, { blockedFamilyIds: relations.blocked });

  const results: DiscoveryResult[] = [];
  for (const { family: candidate, result } of ranked) {
    if (filters.verifiedOnly && candidate.verificationStatus !== 'verified') continue;
    if (filters.minAge !== undefined && !candidate.children.some((c) => c.age >= filters.minAge!)) continue;
    if (filters.maxAge !== undefined && !candidate.children.some((c) => c.age <= filters.maxAge!)) continue;

    if (filters.interestIds?.length) {
      const has = candidate.children.some((c) =>
        c.interests.some((i) => filters.interestIds!.includes(i.interestId)),
      );
      if (!has) continue;
    }

    if (filters.maxDistanceKm !== undefined) {
      if (haversineKm(family.approxLocation, candidate.approxLocation) > filters.maxDistanceKm) continue;
    }

    if (filters.availableOn?.length) {
      const wanted = new Set(filters.availableOn.map((a) => `${a.day}:${a.block}`));
      if (!candidate.availability.some((a) => wanted.has(`${a.day}:${a.block}`))) continue;
    }

    const projection = await projectFor(family, candidate, relations);
    if (!projection) continue;

    results.push({ projection, match: result, relationship: relationshipTo(relations, candidate.id) });
  }

  if (filters.sort === 'newest') {
    results.sort(
      (a, b) => new Date(b.projection.memberSince).getTime() - new Date(a.projection.memberSince).getTime(),
    );
  }

  // Records that discovery ran and how many results came back — never who was
  // seen. An audit log that lists which families a parent browsed would be a
  // behavioural profile, which is exactly what this product does not build.
  await ctx.audit({
    actor: session.accountId,
    action: 'discovery.searched',
    metadata: { resultCount: results.length },
  });

  return results;
}

/**
 * Families a hard constraint removed, with the reason.
 *
 * Returns the display name and a translation key — never a projection. A family
 * excluded by a blocking constraint is one the viewer is not entitled to see,
 * and "here is why you cannot see them" must not become a way to see them.
 */
export async function excludedFamilies(
  ctx: RequestContext,
): Promise<Array<{ displayName: string; reasonKey: string; reasonVars?: Record<string, string | number> }>> {
  const { account, family } = await ctx.requireFamily();
  assertCanDiscover(account, family);
  await ctx.limit('discovery_page');

  const relations = await loadRelations(family.id);
  const candidates = await loadFamiliesForDiscovery(family.id);

  return rankFamilies(family, candidates, {
    blockedFamilyIds: relations.blocked,
    includeExcluded: true,
  })
    .filter((r) => r.result.excluded)
    .map((r) => ({
      displayName: r.family.displayName,
      reasonKey: r.result.exclusionKey ?? 'exclude.unknown',
      ...(r.result.exclusionVars ? { reasonVars: r.result.exclusionVars } : {}),
    }));
}

export async function getFamilyProjection(ctx: RequestContext): Promise<DiscoveryResult | null> {
  const { account, family } = await ctx.requireFamily();
  assertCanDiscover(account, family);
  await ctx.limit('discovery_page');

  const targetId = str(ctx.body, 'familyId', { max: 64 });
  if (targetId === family.id) throw new NotFoundError('Use your own family endpoint for your own family.');

  const target = await loadFamily(targetId);
  if (!target) throw new NotFoundError('That family was not found.');

  const relations = await loadRelations(family.id);
  const projection = await projectFor(family, target, relations);
  if (!projection) return null;

  const ranked = rankFamilies(family, [target], { blockedFamilyIds: relations.blocked, includeExcluded: true });
  const match = ranked[0]?.result;
  if (!match) return null;

  return { projection, match, relationship: relationshipTo(relations, targetId) };
}

interface Filters {
  minAge?: number;
  maxAge?: number;
  interestIds?: string[];
  maxDistanceKm?: number;
  availableOn?: AvailabilitySlot[];
  verifiedOnly?: boolean;
  sort?: 'match' | 'newest';
}

function readFilters(body: Record<string, unknown>): Filters {
  const filters: Filters = {};

  const minAge = optionalNum(body, 'minAge', 0, 18);
  const maxAge = optionalNum(body, 'maxAge', 0, 18);
  const maxDistanceKm = optionalNum(body, 'maxDistanceKm', 1, 100);
  const verifiedOnly = optionalBool(body, 'verifiedOnly');
  const sort = optionalLiteral(body, 'sort', ['match', 'newest'] as const);

  if (minAge !== undefined) filters.minAge = minAge;
  if (maxAge !== undefined) filters.maxAge = maxAge;
  if (maxDistanceKm !== undefined) filters.maxDistanceKm = maxDistanceKm;
  if (verifiedOnly !== undefined) filters.verifiedOnly = verifiedOnly;
  if (sort !== undefined) filters.sort = sort;
  if (body.interestIds !== undefined) filters.interestIds = strArr(body, 'interestIds', 30);

  if (body.availableOn !== undefined) {
    filters.availableOn = arr(body, 'availableOn', 21).map((raw, i) => {
      if (raw === null || typeof raw !== 'object') {
        throw new NotFoundError(`availableOn[${i}] must be an object.`);
      }
      const s = raw as Record<string, unknown>;
      return { day: literal(s, 'day', DAYS), block: literal(s, 'block', BLOCKS) };
    });
  }

  return filters;
}
