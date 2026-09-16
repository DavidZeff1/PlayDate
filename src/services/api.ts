import type {
  Account,
  AppNotification,
  AuditLogEntry,
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
  ModerationCase,
  ModerationActionKind,
  ParentProfile,
  PlayDate,
  PrivacySettings,
  Report,
  ReportReason,
  Session,
  AvailabilitySlot,
  PostMeetingFeedback,
} from '../domain/types';
import type { MatchResult } from '../domain/matching/types';

/**
 * The API contract.
 *
 * Everything the UI can do goes through this interface. The prototype ships a mock
 * implementation backed by localStorage; swapping in an HTTP implementation means
 * writing one class and changing one line in `services/index.ts` — no page or component
 * changes, because no page or component reaches past this boundary.
 *
 * Two properties of the contract are load-bearing for safety:
 *
 *  1. **No method returns another family's raw `Family` record.** Cross-family reads
 *     return `FamilyProjection`, which physically cannot carry private fields.
 *
 *  2. **Authorization, rate limiting and audit logging live behind this interface,**
 *     not in the components that call it. A new page cannot forget to check.
 */

export interface SignUpInput {
  email: string;
  phone: string;
  password: string;
}

export interface FamilyProfileInput {
  displayName: string;
  generalArea: string;
  neighborhood?: string;
  about?: string;
  languages: string[];
}

export interface ChildInput {
  firstName: string;
  nickname?: string;
  age: number;
  pronouns?: string;
  notes?: string;
  temperament?: Child['temperament'];
  interests: Child['interests'];
}

/** A discovery result: what the viewer may see, plus why this family surfaced. */
export interface DiscoveryResult {
  projection: FamilyProjection;
  match: MatchResult;
  /** Whether the viewer already has a pending/accepted request with this family. */
  relationship: 'none' | 'request_sent' | 'request_received' | 'connected' | 'declined';
}

export interface DiscoveryFilters {
  minAge?: number;
  maxAge?: number;
  interestIds?: string[];
  maxDistanceKm?: number;
  availableOn?: AvailabilitySlot[];
  verifiedOnly?: boolean;
  /** Sort by match quality (default) or by recency of joining. */
  sort?: 'match' | 'newest';
}

export interface DashboardSummary {
  family: Family;
  parent: ParentProfile;
  account: Account;
  matchCount: number;
  pendingIncomingRequests: number;
  pendingOutgoingRequests: number;
  unreadMessages: number;
  upcomingPlaydates: PlayDate[];
  unreadNotifications: number;
  /** Things the parent should do next, ordered. Drives the dashboard's "what now?". */
  nextSteps: NextStep[];
}

/**
 * A dashboard "what can I do now?" item. Keys, not sentences — the same rule the
 * matching scorers follow, for the same reason.
 */
export interface NextStep {
  id: string;
  titleKey: string;
  titleVars?: Record<string, string | number>;
  descKey: string;
  ctaKey: string;
  href: string;
  tone: 'action' | 'safety' | 'info';
}

export interface VerificationState {
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  identityStatus: Family['verificationStatus'];
  identityUpdatedAt?: string;
  failureReason?: string;
  provider?: string;
  /** Explicitly surfaces that this prototype's check is simulated. */
  isMockProvider: boolean;
}

export interface ConversationView {
  conversation: Conversation;
  otherFamily: FamilyProjection;
  connection: Connection;
}

export interface RequestView {
  request: ConnectionRequest;
  otherFamily: FamilyProjection;
  match?: MatchResult;
}

export interface PlayDateView {
  playdate: PlayDate;
  otherFamily: FamilyProjection;
}

export interface AdminOverview {
  pendingVerifications: Array<{
    parentId: string;
    familyDisplayName: string;
    submittedAt: string;
    status: Family['verificationStatus'];
  }>;
  openCases: ModerationCase[];
  accounts: Array<{
    accountId: string;
    familyId: string;
    familyDisplayName: string;
    state: Account['state'];
    verification: Family['verificationStatus'];
    joinedAt: string;
  }>;
  auditLog: AuditLogEntry[];
}

export interface PlayDateApi {
  // -- Auth ---------------------------------------------------------------
  signUp(input: SignUpInput): Promise<{ session: Session }>;
  signIn(email: string, password: string): Promise<{ session: Session }>;
  signInAsDemo(): Promise<{ session: Session }>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  getDeviceSessions(): Promise<DeviceSession[]>;
  revokeDeviceSession(id: string): Promise<void>;

  // -- Verification -------------------------------------------------------
  sendEmailCode(): Promise<{ hint: string }>;
  sendPhoneCode(): Promise<{ hint: string }>;
  confirmEmailCode(code: string): Promise<void>;
  confirmPhoneCode(code: string): Promise<void>;
  setTwoFactor(enabled: boolean): Promise<void>;
  startIdentityVerification(input: {
    legalFirstName: string;
    legalLastName: string;
    dateOfBirth: string;
  }): Promise<{ status: Family['verificationStatus'] }>;
  /** Prototype affordance: resolve the simulated check so the demo can proceed. */
  resolveMockVerification(outcome: 'verified' | 'failed'): Promise<void>;
  getVerificationState(): Promise<VerificationState>;

  // -- Family -------------------------------------------------------------
  createFamily(input: FamilyProfileInput): Promise<Family>;
  getMyFamily(): Promise<Family | null>;
  updateFamilyProfile(input: Partial<FamilyProfileInput>): Promise<Family>;
  updatePreferences(prefs: Partial<FamilyPreferences>): Promise<Family>;
  updateAvailability(slots: AvailabilitySlot[]): Promise<Family>;
  updatePrivacy(privacy: Partial<PrivacySettings>): Promise<Family>;
  acceptSafetyGuidelines(): Promise<void>;

  // -- Children -----------------------------------------------------------
  addChild(input: ChildInput): Promise<Child>;
  updateChild(childId: string, input: Partial<ChildInput>): Promise<Child>;
  removeChild(childId: string): Promise<void>;

  // -- Discovery ----------------------------------------------------------
  discoverFamilies(filters?: DiscoveryFilters): Promise<DiscoveryResult[]>;
  /**
   * Families filtered out by a hard constraint, with the reason as a translation key.
   * Viewer's own view only — no projection is built for a family they cannot see.
   */
  excludedFamilies(): Promise<
    Array<{ displayName: string; reasonKey: string; reasonVars?: Record<string, string | number> }>
  >;
  getFamilyProjection(familyId: string): Promise<DiscoveryResult | null>;
  getDashboard(): Promise<DashboardSummary>;

  // -- Consent ------------------------------------------------------------
  sendConnectionRequest(toFamilyId: string, note?: string): Promise<ConnectionRequest>;
  respondToRequest(
    requestId: string,
    response: 'accepted' | 'declined' | 'deferred',
  ): Promise<ConnectionRequest>;
  withdrawRequest(requestId: string): Promise<void>;
  getIncomingRequests(): Promise<RequestView[]>;
  getOutgoingRequests(): Promise<RequestView[]>;
  getConnections(): Promise<ConversationView[]>;

  // -- Messaging ----------------------------------------------------------
  getConversation(conversationId: string): Promise<ConversationView>;
  sendMessage(conversationId: string, body: string): Promise<Message>;
  leaveConversation(conversationId: string): Promise<void>;
  markConversationRead(conversationId: string): Promise<void>;

  // -- PlayDates ----------------------------------------------------------
  proposePlayDate(input: {
    connectionId: string;
    activity: string;
    place: MeetingPlace;
    startsAt: string;
    durationMinutes: number;
    notes?: string;
    attendingChildIds: string[];
    adultPresent: boolean;
  }): Promise<PlayDate>;
  respondToPlayDate(
    playdateId: string,
    response: 'confirmed' | 'declined',
    opts?: { attendingChildIds?: string[]; adultPresent?: boolean },
  ): Promise<PlayDate>;
  cancelPlayDate(playdateId: string, reason?: string): Promise<PlayDate>;
  sharePlanWithTrustedAdult(playdateId: string, name: string): Promise<PlayDate>;
  submitPostMeetingFeedback(playdateId: string, feedback: Omit<PostMeetingFeedback, 'submittedAt'>): Promise<PlayDate>;
  getPlayDates(): Promise<PlayDateView[]>;

  // -- Safety -------------------------------------------------------------
  reportFamily(input: {
    reportedFamilyId: string;
    reason: ReportReason;
    details: string;
    evidenceMessageIds?: string[];
    alsoBlock?: boolean;
  }): Promise<Report>;
  blockFamily(familyId: string, reason?: string): Promise<void>;
  unblockFamily(familyId: string): Promise<void>;
  getBlockedFamilies(): Promise<Array<{ familyId: string; displayName: string; createdAt: string }>>;
  getMyReports(): Promise<Report[]>;

  // -- Notifications ------------------------------------------------------
  getNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // -- Admin --------------------------------------------------------------
  adminOverview(): Promise<AdminOverview>;
  adminDecideVerification(parentId: string, outcome: 'verified' | 'failed', rationale: string): Promise<void>;
  adminActOnCase(caseId: string, action: ModerationActionKind, rationale: string): Promise<ModerationCase>;
  adminAddCaseNote(caseId: string, body: string): Promise<ModerationCase>;

  // -- Prototype utilities ------------------------------------------------
  /** Reset all local state back to the seed. Prototype affordance only. */
  resetPrototype(): Promise<void>;
}
