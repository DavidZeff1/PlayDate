import type { RequestContext } from './context';
import { NotFoundError } from './errors';
import * as auth from '../handlers/auth';
import * as verification from '../handlers/verification';
import * as family from '../handlers/family';
import * as discovery from '../handlers/discovery';
import * as dashboard from '../handlers/dashboard';
import * as pending from '../handlers/pending';

/**
 * The route table.
 *
 * One entry per method on `PlayDateApi`, named after it. The API is RPC-shaped
 * rather than REST-shaped because the contract it implements already is —
 * inventing resource URLs would mean inventing a second contract to keep in
 * sync with the first.
 *
 * Everything is POST, including reads. That is deliberate:
 *
 *  - reads take structured filters that belong in a body, not a query string
 *    that ends up in access logs and browser history;
 *  - it means the CSRF check in `csrf.ts` applies uniformly, with no "safe
 *    method" carve-out to reason about;
 *  - no response here is cacheable anyway — they are all per-account.
 *
 * `GET /api/health` is the one exception, and returns nothing about the user.
 */

export type Handler = (ctx: RequestContext) => Promise<unknown>;

export const ROUTES: Record<string, Handler> = {
  // -- Auth -----------------------------------------------------------------
  'signUp': auth.signUp,
  'signIn': auth.signIn,
  'signInAsDemo': auth.signInAsDemo,
  'signOut': auth.signOut,
  'getSession': auth.getSession,
  'getDeviceSessions': auth.getDeviceSessions,
  'revokeDeviceSession': auth.revokeDeviceSession,

  // -- Verification ---------------------------------------------------------
  'sendEmailCode': verification.sendEmailCode,
  'sendPhoneCode': verification.sendPhoneCode,
  'confirmEmailCode': verification.confirmEmailCode,
  'confirmPhoneCode': verification.confirmPhoneCode,
  'setTwoFactor': verification.setTwoFactor,
  'startIdentityVerification': verification.startIdentityVerification,
  'resolveMockVerification': verification.resolveMockVerification,
  'getVerificationState': verification.getVerificationState,

  // -- Family ---------------------------------------------------------------
  'createFamily': family.createFamily,
  'getMyFamily': family.getMyFamily,
  'updateFamilyProfile': family.updateProfile,
  'updatePreferences': family.updatePreferences,
  'updateAvailability': family.updateAvailability,
  'updatePrivacy': family.updatePrivacy,
  'acceptSafetyGuidelines': family.acceptSafetyGuidelines,

  // -- Children -------------------------------------------------------------
  'addChild': family.addChild,
  'updateChild': family.updateChild,
  'removeChild': family.removeChild,

  // -- Discovery ------------------------------------------------------------
  'discoverFamilies': discovery.discoverFamilies,
  'excludedFamilies': discovery.excludedFamilies,
  'getFamilyProjection': discovery.getFamilyProjection,
  'getDashboard': dashboard.getDashboard,

  // -- Consent (pending) ----------------------------------------------------
  'sendConnectionRequest': pending.sendConnectionRequest,
  'respondToRequest': pending.respondToRequest,
  'withdrawRequest': pending.withdrawRequest,
  'getIncomingRequests': pending.getIncomingRequests,
  'getOutgoingRequests': pending.getOutgoingRequests,
  'getConnections': pending.getConnections,

  // -- Messaging (pending) --------------------------------------------------
  'getConversation': pending.getConversation,
  'sendMessage': pending.sendMessage,
  'leaveConversation': pending.leaveConversation,
  'markConversationRead': pending.markConversationRead,

  // -- PlayDates (pending) --------------------------------------------------
  'proposePlayDate': pending.proposePlayDate,
  'respondToPlayDate': pending.respondToPlayDate,
  'cancelPlayDate': pending.cancelPlayDate,
  'sharePlanWithTrustedAdult': pending.sharePlanWithTrustedAdult,
  'submitPostMeetingFeedback': pending.submitPostMeetingFeedback,
  'getPlayDates': pending.getPlayDates,

  // -- Safety (pending) -----------------------------------------------------
  'reportFamily': pending.reportFamily,
  'blockFamily': pending.blockFamily,
  'unblockFamily': pending.unblockFamily,
  'getBlockedFamilies': pending.getBlockedFamilies,
  'getMyReports': pending.getMyReports,

  // -- Notifications (pending) ----------------------------------------------
  'getNotifications': pending.getNotifications,
  'markNotificationRead': pending.markNotificationRead,
  'markAllNotificationsRead': pending.markAllNotificationsRead,

  // -- Admin (pending) ------------------------------------------------------
  'adminOverview': pending.adminOverview,
  'adminDecideVerification': pending.adminDecideVerification,
  'adminActOnCase': pending.adminActOnCase,
  'adminAddCaseNote': pending.adminAddCaseNote,
};

/**
 * `resetPrototype` is deliberately absent.
 *
 * It existed so a browser-local demo could wipe its own sandbox. Against a
 * shared database the same call would be "delete everyone's data", so there is
 * no server route for it and the HTTP client throws instead.
 */

export function resolveRoute(operation: string): Handler {
  const handler = Object.prototype.hasOwnProperty.call(ROUTES, operation)
    ? ROUTES[operation]
    : undefined;
  if (!handler) throw new NotFoundError(`Unknown operation: ${operation}`, 'unknown_operation');
  return handler;
}
