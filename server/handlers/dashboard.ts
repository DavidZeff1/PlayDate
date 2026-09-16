import type { DashboardSummary, NextStep } from '../../src/services/api';
import type { PlayDate } from '../../src/domain/types';
import { sql } from '../db/client';
import {
  completedPlaydateCount,
  loadParentIdentity,
  loadParentProfile,
  trustSignalsFor,
  upheldReportCount,
} from '../db/repos/accounts';
import { loadFamiliesForDiscovery } from '../db/repos/families';
import { rankFamilies } from '../../src/domain/matching/engine';
import type { RequestContext } from '../http/context';
import { NotFoundError } from '../http/errors';

/**
 * The dashboard.
 *
 * Answers one question — what can I do now? — so next steps come first and are
 * emitted as translation KEYS, exactly as `NextStep` requires. A server that
 * returned "Verify your phone number" would be a server that only works in
 * English.
 */
export async function getDashboard(ctx: RequestContext): Promise<DashboardSummary> {
  const { session, account, family } = await ctx.requireFamily();

  const profile = await loadParentProfile(session.parentId);
  if (!profile) throw new NotFoundError('Parent profile not found.');

  const identity = await loadParentIdentity(session.parentId);
  const identityStatus = identity?.verificationStatus ?? 'unstarted';

  const [counts, upcoming, completed, upheld] = await Promise.all([
    sql`
      SELECT
        (SELECT count(*)::int FROM connection_requests
          WHERE to_family_id = ${family.id} AND status = 'pending')       AS incoming,
        (SELECT count(*)::int FROM connection_requests
          WHERE from_family_id = ${family.id} AND status = 'pending')     AS outgoing,
        (SELECT count(*)::int FROM notifications
          WHERE family_id = ${family.id} AND read = FALSE)                AS unread_notifications,
        (SELECT count(*)::int
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           LEFT JOIN conversation_reads r
                  ON r.conversation_id = c.id AND r.family_id = ${family.id}
          WHERE (c.family_a_id = ${family.id} OR c.family_b_id = ${family.id})
            AND m.sender_family_id <> ${family.id}
            AND (r.read_at IS NULL OR m.sent_at > r.read_at))             AS unread_messages
    ` as unknown as Promise<
      Array<{ incoming: number; outgoing: number; unread_notifications: number; unread_messages: number }>
    >,
    sql`
      SELECT * FROM playdates
       WHERE (family_a_id = ${family.id} OR family_b_id = ${family.id})
         AND status IN ('proposed', 'confirmed')
         AND starts_at > now()
       ORDER BY starts_at
       LIMIT 5
    ` as unknown as Promise<Array<Record<string, unknown>>>,
    completedPlaydateCount(family.id),
    upheldReportCount(family.id),
  ]);

  profile.trustSignals = await trustSignalsFor({
    account,
    profile,
    identityStatus,
    completedPlaydates: completed,
    secondaryParentVerified: false,
    profileComplete: Boolean(family.about && family.children.length > 0),
    upheldReports: upheld,
  });

  // Match count is computed, not stored: a stale "12 families match" is worse
  // than none. Skipped entirely when the parent cannot browse yet, because
  // running discovery for someone who is gated would be doing the thing the
  // gate exists to prevent.
  let matchCount = 0;
  const canBrowse =
    account.emailVerified && account.phoneVerified && family.verificationStatus === 'verified';
  if (canBrowse) {
    const candidates = await loadFamiliesForDiscovery(family.id);
    matchCount = rankFamilies(family, candidates).length;
  }

  const row = counts[0];

  return {
    family,
    parent: profile,
    account,
    matchCount,
    pendingIncomingRequests: row?.incoming ?? 0,
    pendingOutgoingRequests: row?.outgoing ?? 0,
    unreadMessages: row?.unread_messages ?? 0,
    unreadNotifications: row?.unread_notifications ?? 0,
    upcomingPlaydates: upcoming as unknown as PlayDate[],
    nextSteps: buildNextSteps({
      emailVerified: account.emailVerified,
      phoneVerified: account.phoneVerified,
      identityStatus,
      childCount: family.children.length,
      interestCount: family.children.reduce((n, c) => n + c.interests.length, 0),
      availabilityCount: family.availability.length,
      guidelinesAccepted: Boolean(account.safetyGuidelinesAcceptedAt),
      incomingRequests: row?.incoming ?? 0,
      discoverable: family.privacy.discoverable,
    }),
  };
}

/**
 * Next steps, in the order a parent should do them.
 *
 * Ordered by the safety model rather than by effort: identity before profile,
 * profile before discovery. Returning keys rather than sentences is what lets
 * the same list render in Hebrew.
 */
function buildNextSteps(input: {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityStatus: string;
  childCount: number;
  interestCount: number;
  availabilityCount: number;
  guidelinesAccepted: boolean;
  incomingRequests: number;
  discoverable: boolean;
}): NextStep[] {
  const steps: NextStep[] = [];

  if (!input.emailVerified) {
    steps.push(step('verifyEmail', '/app/verification', 'safety'));
  }
  if (!input.phoneVerified) {
    steps.push(step('verifyPhone', '/app/verification', 'safety'));
  }
  if (input.identityStatus !== 'verified' && input.identityStatus !== 'pending') {
    steps.push(step('verifyIdentity', '/app/verification', 'safety'));
  }
  if (input.childCount === 0) {
    steps.push(step('addChild', '/app/children', 'action'));
  } else if (input.interestCount < 3) {
    steps.push(step('addInterests', '/app/children', 'action'));
  }
  if (input.availabilityCount === 0) {
    steps.push(step('setAvailability', '/app/settings', 'action'));
  }
  if (!input.guidelinesAccepted) {
    steps.push(step('readSafety', '/app/safety-centre', 'safety'));
  }
  if (input.incomingRequests > 0) {
    steps.push({
      id: 'respondRequests',
      titleKey: 'step.respondRequests.title',
      titleVars: { n: input.incomingRequests },
      descKey: 'step.respondRequests.desc',
      ctaKey: 'step.respondRequests.cta',
      href: '/app/requests',
      tone: 'action',
    });
  }
  if (!input.discoverable) {
    steps.push(step('notDiscoverable', '/app/settings', 'info'));
  }

  return steps;
}

function step(id: string, href: string, tone: NextStep['tone']): NextStep {
  return {
    id,
    titleKey: `step.${id}.title`,
    descKey: `step.${id}.desc`,
    ctaKey: `step.${id}.cta`,
    href,
    tone,
  };
}
