import type { RequestContext } from '../http/context';
import { NotImplementedError } from '../http/errors';

/**
 * Endpoints not yet ported from the mock.
 *
 * Each one is registered in the router with its real guard, so the security
 * sequence is already in place and finishing an endpoint is filling in a
 * function body — not deciding afresh who is allowed to call it.
 *
 * `mockApi.ts` is the reference implementation: it already encodes the correct
 * order (resolve session → rate limit → authorize → mutate → audit) and the
 * business rules for each of these. Porting one means swapping its store reads
 * for repository calls, not redesigning it.
 *
 * Order they are being done in — see docs/BACKEND.md:
 *   1. consent      (requests, responses, connections)
 *   2. messaging    (conversations, send, leave, read markers)
 *   3. playdates    (propose, respond, cancel, share, feedback)
 *   4. safety       (report, block, unblock, my reports)
 *   5. notifications
 *   6. admin        (queue, decisions, cases, audit)
 */

function pending(operation: string) {
  return async (ctx: RequestContext): Promise<never> => {
    // The guard still runs: an unauthenticated caller gets 401, not 501. A
    // stub that answers "not implemented" to anyone is a stub that tells you
    // which endpoints exist before you have signed in.
    await ctx.requireAccount();
    throw new NotImplementedError(operation);
  };
}

/** Requires a family as well — most of these are family-scoped. */
function pendingFamily(operation: string) {
  return async (ctx: RequestContext): Promise<never> => {
    await ctx.requireFamily();
    throw new NotImplementedError(operation);
  };
}

function pendingStaff(operation: string) {
  return async (ctx: RequestContext): Promise<never> => {
    ctx.requireRole('moderator', 'verification_agent', 'admin');
    throw new NotImplementedError(operation);
  };
}

// -- Consent ----------------------------------------------------------------
export const sendConnectionRequest = pendingFamily('Sending a connection request');
export const respondToRequest = pendingFamily('Responding to a request');
export const withdrawRequest = pendingFamily('Withdrawing a request');
export const getIncomingRequests = pendingFamily('Listing incoming requests');
export const getOutgoingRequests = pendingFamily('Listing outgoing requests');
export const getConnections = pendingFamily('Listing connections');

// -- Messaging --------------------------------------------------------------
export const getConversation = pendingFamily('Reading a conversation');
export const sendMessage = pendingFamily('Sending a message');
export const leaveConversation = pendingFamily('Leaving a conversation');
export const markConversationRead = pendingFamily('Marking a conversation read');

// -- PlayDates --------------------------------------------------------------
export const proposePlayDate = pendingFamily('Proposing a playdate');
export const respondToPlayDate = pendingFamily('Responding to a playdate');
export const cancelPlayDate = pendingFamily('Cancelling a playdate');
export const sharePlanWithTrustedAdult = pendingFamily('Sharing a plan with a trusted adult');
export const submitPostMeetingFeedback = pendingFamily('Submitting post-meeting feedback');
export const getPlayDates = pendingFamily('Listing playdates');

// -- Safety -----------------------------------------------------------------
export const reportFamily = pendingFamily('Reporting a family');
export const blockFamily = pendingFamily('Blocking a family');
export const unblockFamily = pendingFamily('Unblocking a family');
export const getBlockedFamilies = pendingFamily('Listing blocked families');
export const getMyReports = pendingFamily('Listing your reports');

// -- Notifications ----------------------------------------------------------
export const getNotifications = pendingFamily('Listing notifications');
export const markNotificationRead = pendingFamily('Marking a notification read');
export const markAllNotificationsRead = pendingFamily('Marking all notifications read');

// -- Admin ------------------------------------------------------------------
export const adminOverview = pendingStaff('The moderation overview');
export const adminDecideVerification = pendingStaff('Deciding a verification');
export const adminActOnCase = pendingStaff('Acting on a case');
export const adminAddCaseNote = pendingStaff('Adding a case note');

export { pending };
