import type {
  Account,
  AppNotification,
  AuditLogEntry,
  AvailabilitySlot,
  Child,
  Connection,
  ConnectionRequest,
  Conversation,
  DeviceSession,
  Family,
  FamilyPreferences,
  FamilyProjection,
  MeetingPlace,
  Message,
  ModerationActionKind,
  ModerationCase,
  ParentProfile,
  PlayDate,
  PostMeetingFeedback,
  PrivacySettings,
  Report,
  ReportReason,
  Session,
} from '../../domain/types';
import type {
  AdminOverview,
  ChildInput,
  ConversationView,
  DashboardSummary,
  DiscoveryFilters,
  DiscoveryResult,
  FamilyProfileInput,
  PlayDateApi,
  PlayDateView,
  RequestView,
  SignUpInput,
  VerificationState,
} from '../api';
import { AuthorizationError } from '../security/guards';
import { RateLimitError } from '../security/rateLimit';
import { NotFoundError, ValidationError } from '../errors';

/**
 * HTTP implementation of `PlayDateApi`.
 *
 * Every method is the same shape: POST the arguments as JSON to
 * `/api/<operation>`, and map a wire error back onto the error class the UI
 * already catches. No page or component changes, because none of them reach
 * past the interface.
 *
 * Three things this client deliberately does NOT do:
 *
 *  - **It never sends a token.** The session is an HttpOnly cookie the browser
 *    attaches; this code cannot read it, and neither can an XSS.
 *  - **It never caches.** A stale projection is a privacy decision made with
 *    out-of-date consent — if a family withdraws, the next read must reflect it.
 *  - **It never retries a mutation.** A retried `sendConnectionRequest` is a
 *    second unsolicited contact, which is the exact thing the rate limits exist
 *    to prevent.
 */

interface WireErrorBody {
  error?: { code?: string; message?: string; field?: string; retryAfterSeconds?: number };
}

export class HttpPlayDateApi implements PlayDateApi {
  constructor(private readonly baseUrl = '/api') {}

  private async call<T>(operation: string, args: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${operation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Required by the server's CSRF check. A cross-origin form POST
          // cannot set this, and a cross-origin fetch that tries is stopped by
          // the preflight.
          'X-PlayDate-Request': '1',
        },
        // Send the session cookie. `same-origin` rather than `include` so the
        // credentials never travel to another origin by accident.
        credentials: 'same-origin',
        body: JSON.stringify(args),
      });
    } catch {
      throw new Error('Could not reach PlayDate. Check your connection and try again.');
    }

    if (response.status === 204) return null as T;

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw toClientError(response.status, payload as WireErrorBody);
    }

    return payload as T;
  }

  // -- Auth -----------------------------------------------------------------
  signUp(input: SignUpInput) {
    return this.call<{ session: Session }>('signUp', { ...input });
  }
  signIn(email: string, password: string) {
    return this.call<{ session: Session }>('signIn', { email, password });
  }
  signInAsDemo() {
    return this.call<{ session: Session }>('signInAsDemo');
  }
  signOut() {
    return this.call<void>('signOut');
  }
  getSession() {
    return this.call<Session | null>('getSession');
  }
  getDeviceSessions() {
    return this.call<DeviceSession[]>('getDeviceSessions');
  }
  revokeDeviceSession(id: string) {
    return this.call<void>('revokeDeviceSession', { id });
  }

  // -- Verification ---------------------------------------------------------
  sendEmailCode() {
    return this.call<{ hint: string }>('sendEmailCode');
  }
  sendPhoneCode() {
    return this.call<{ hint: string }>('sendPhoneCode');
  }
  confirmEmailCode(code: string) {
    return this.call<void>('confirmEmailCode', { code });
  }
  confirmPhoneCode(code: string) {
    return this.call<void>('confirmPhoneCode', { code });
  }
  setTwoFactor(enabled: boolean) {
    return this.call<void>('setTwoFactor', { enabled });
  }
  startIdentityVerification(input: { legalFirstName: string; legalLastName: string; dateOfBirth: string }) {
    return this.call<{ status: Family['verificationStatus'] }>('startIdentityVerification', { ...input });
  }
  resolveMockVerification(outcome: 'verified' | 'failed') {
    return this.call<void>('resolveMockVerification', { outcome });
  }
  getVerificationState() {
    return this.call<VerificationState>('getVerificationState');
  }

  // -- Family ---------------------------------------------------------------
  createFamily(input: FamilyProfileInput) {
    return this.call<Family>('createFamily', { ...input });
  }
  getMyFamily() {
    return this.call<Family | null>('getMyFamily');
  }
  updateFamilyProfile(input: Partial<FamilyProfileInput>) {
    return this.call<Family>('updateFamilyProfile', { ...input });
  }
  updatePreferences(prefs: Partial<FamilyPreferences>) {
    return this.call<Family>('updatePreferences', { ...prefs });
  }
  updateAvailability(slots: AvailabilitySlot[]) {
    return this.call<Family>('updateAvailability', { slots });
  }
  updatePrivacy(privacy: Partial<PrivacySettings>) {
    return this.call<Family>('updatePrivacy', { ...privacy });
  }
  acceptSafetyGuidelines() {
    return this.call<void>('acceptSafetyGuidelines');
  }

  // -- Children -------------------------------------------------------------
  addChild(input: ChildInput) {
    return this.call<Child>('addChild', { ...input });
  }
  updateChild(childId: string, input: Partial<ChildInput>) {
    return this.call<Child>('updateChild', { childId, ...input });
  }
  removeChild(childId: string) {
    return this.call<void>('removeChild', { childId });
  }

  // -- Discovery ------------------------------------------------------------
  discoverFamilies(filters: DiscoveryFilters = {}) {
    return this.call<DiscoveryResult[]>('discoverFamilies', { ...filters });
  }
  excludedFamilies() {
    return this.call<Array<{ displayName: string; reasonKey: string; reasonVars?: Record<string, string | number> }>>(
      'excludedFamilies',
    );
  }
  getFamilyProjection(familyId: string) {
    return this.call<DiscoveryResult | null>('getFamilyProjection', { familyId });
  }
  getDashboard() {
    return this.call<DashboardSummary>('getDashboard');
  }

  // -- Consent --------------------------------------------------------------
  sendConnectionRequest(toFamilyId: string, note?: string) {
    return this.call<ConnectionRequest>('sendConnectionRequest', { toFamilyId, note });
  }
  respondToRequest(requestId: string, response: 'accepted' | 'declined' | 'deferred') {
    return this.call<ConnectionRequest>('respondToRequest', { requestId, response });
  }
  withdrawRequest(requestId: string) {
    return this.call<void>('withdrawRequest', { requestId });
  }
  getIncomingRequests() {
    return this.call<RequestView[]>('getIncomingRequests');
  }
  getOutgoingRequests() {
    return this.call<RequestView[]>('getOutgoingRequests');
  }
  getConnections() {
    return this.call<ConversationView[]>('getConnections');
  }

  // -- Messaging ------------------------------------------------------------
  getConversation(conversationId: string) {
    return this.call<ConversationView>('getConversation', { conversationId });
  }
  sendMessage(conversationId: string, body: string) {
    return this.call<Message>('sendMessage', { conversationId, body });
  }
  leaveConversation(conversationId: string) {
    return this.call<void>('leaveConversation', { conversationId });
  }
  markConversationRead(conversationId: string) {
    return this.call<void>('markConversationRead', { conversationId });
  }

  // -- PlayDates ------------------------------------------------------------
  proposePlayDate(input: {
    connectionId: string;
    activity: string;
    place: MeetingPlace;
    startsAt: string;
    durationMinutes: number;
    notes?: string;
    attendingChildIds: string[];
    adultPresent: boolean;
  }) {
    return this.call<PlayDate>('proposePlayDate', { ...input });
  }
  respondToPlayDate(
    playdateId: string,
    response: 'confirmed' | 'declined',
    opts?: { attendingChildIds?: string[]; adultPresent?: boolean },
  ) {
    return this.call<PlayDate>('respondToPlayDate', { playdateId, response, ...opts });
  }
  cancelPlayDate(playdateId: string, reason?: string) {
    return this.call<PlayDate>('cancelPlayDate', { playdateId, reason });
  }
  sharePlanWithTrustedAdult(playdateId: string, name: string) {
    return this.call<PlayDate>('sharePlanWithTrustedAdult', { playdateId, name });
  }
  submitPostMeetingFeedback(playdateId: string, feedback: Omit<PostMeetingFeedback, 'submittedAt'>) {
    return this.call<PlayDate>('submitPostMeetingFeedback', { playdateId, ...feedback });
  }
  getPlayDates() {
    return this.call<PlayDateView[]>('getPlayDates');
  }

  // -- Safety ---------------------------------------------------------------
  reportFamily(input: {
    reportedFamilyId: string;
    reason: ReportReason;
    details: string;
    evidenceMessageIds?: string[];
    alsoBlock?: boolean;
  }) {
    return this.call<Report>('reportFamily', { ...input });
  }
  blockFamily(familyId: string, reason?: string) {
    return this.call<void>('blockFamily', { familyId, reason });
  }
  unblockFamily(familyId: string) {
    return this.call<void>('unblockFamily', { familyId });
  }
  getBlockedFamilies() {
    return this.call<Array<{ familyId: string; displayName: string; createdAt: string }>>('getBlockedFamilies');
  }
  getMyReports() {
    return this.call<Report[]>('getMyReports');
  }

  // -- Notifications --------------------------------------------------------
  getNotifications() {
    return this.call<AppNotification[]>('getNotifications');
  }
  markNotificationRead(id: string) {
    return this.call<void>('markNotificationRead', { id });
  }
  markAllNotificationsRead() {
    return this.call<void>('markAllNotificationsRead');
  }

  // -- Admin ----------------------------------------------------------------
  adminOverview() {
    return this.call<AdminOverview>('adminOverview');
  }
  adminDecideVerification(parentId: string, outcome: 'verified' | 'failed', rationale: string) {
    return this.call<void>('adminDecideVerification', { parentId, outcome, rationale });
  }
  adminActOnCase(caseId: string, action: ModerationActionKind, rationale: string) {
    return this.call<ModerationCase>('adminActOnCase', { caseId, action, rationale });
  }
  adminAddCaseNote(caseId: string, body: string) {
    return this.call<ModerationCase>('adminAddCaseNote', { caseId, body });
  }

  /**
   * No server route exists for this, on purpose.
   *
   * Against a browser-local store it wiped your own sandbox. Against a shared
   * database the same call means "delete everyone's data", so it fails here
   * rather than at a route that should never be written.
   */
  async resetPrototype(): Promise<void> {
    throw new Error('resetPrototype is only available in the local prototype, not against a server.');
  }
}

/**
 * Map a wire error onto the class the UI catches.
 *
 * The server's `code` is the contract — not the HTTP status and not the
 * message, both of which change for reasons that should not break a catch
 * block.
 */
function toClientError(status: number, payload: WireErrorBody | null): Error {
  const code = payload?.error?.code ?? 'internal';
  const message = payload?.error?.message ?? 'Something went wrong. Please try again.';

  if (status === 429) {
    return new RateLimitError(message, payload?.error?.retryAfterSeconds ?? 60, code);
  }
  if (status === 401 || status === 403) {
    return new AuthorizationError(message, code);
  }
  if (status === 404) {
    return new NotFoundError(message);
  }
  if (status === 400 || status === 409) {
    return new ValidationError(message, payload?.error?.field);
  }
  return new Error(message);
}

/** Unused imports kept honest: these types are part of the implemented contract. */
export type { Account, AuditLogEntry, Connection, Conversation, FamilyProjection, ParentProfile };
