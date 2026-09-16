/**
 * PlayDate — core domain types.
 *
 * Two rules govern this file:
 *
 *  1. A child is never a principal. There is no `Child` branch in any auth or actor
 *     union, and `Child` carries no credentials, no contact details and no session.
 *     Children are dependent records owned by a `Family`.
 *
 *  2. Private identity data and social/discovery data live in separate types that are
 *     never merged. `ParentIdentity` (legal name, DOB, phone, ID reference) has no path
 *     into `FamilyProjection` — see `domain/privacy/redaction.ts`.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type AccountId = string;
export type ParentId = string;
export type FamilyId = string;
export type ChildId = string;
export type ConnectionId = string;
export type RequestId = string;
export type ConversationId = string;
export type MessageId = string;
export type PlayDateId = string;
export type ReportId = string;
export type CaseId = string;

// ---------------------------------------------------------------------------
// Accounts, roles, verification
// ---------------------------------------------------------------------------

/**
 * Platform roles. Least privilege: a verification agent sees identity decisions but
 * never conversations; a moderator sees reported content within an open case but never
 * a family's full message history.
 */
export type Role = 'parent' | 'moderator' | 'verification_agent' | 'admin';

/**
 * Account lifecycle states. Reports never change this directly — only a moderator
 * decision does. See `docs/ARCHITECTURE.md` §2.3.
 */
export type AccountState =
  | 'active'
  | 'verification_required'
  | 'under_review'
  | 'restricted'
  | 'suspended'
  | 'banned';

export type VerificationStatus =
  | 'unstarted'
  | 'required'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired';

/** One verifiable fact about a parent. Deliberately plural — there is no single score. */
export type TrustSignalKind =
  | 'email_verified'
  | 'phone_verified'
  | 'government_id_verified'
  | 'two_factor_enabled'
  | 'secondary_parent_verified'
  | 'profile_complete'
  | 'account_age'
  | 'completed_playdates'
  | 'community_standing';

export interface TrustSignal {
  kind: TrustSignalKind;
  /** Whether the signal is currently satisfied. */
  satisfied: boolean;
  /**
   * Optional detail line, as a translation key plus values — "Member since March 2024",
   * "11 playdates completed". A pre-composed sentence here would be untranslatable.
   */
  detailKey?: string;
  detailVars?: Record<string, string | number>;
  /** ISO date for detail lines that render a month name in the reader's locale. */
  detailDate?: string;
  /** For count-like signals (completed playdates, account age in months). */
  value?: number;
}

export interface Account {
  id: AccountId;
  email: string;
  /**
   * PROTOTYPE ONLY. A real system never sees a plaintext password on the client and
   * never stores one anywhere. Production: Argon2id, server-side. See SECURITY.md.
   */
  passwordHash: string;
  phone: string;
  role: Role;
  state: AccountState;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
  /** Safety guidelines acknowledgement — recorded with a timestamp for audit. */
  safetyGuidelinesAcceptedAt?: string;
}

/**
 * PRIVATE. Never projected to another family under any disclosure tier.
 * Readable by: the parent themselves, and a moderator/verification agent acting on an
 * open case (which writes an audit entry).
 */
export interface ParentIdentity {
  parentId: ParentId;
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  /** Opaque reference from the verification provider. We never store ID images. */
  verificationProviderRef?: string;
  verificationProvider?: 'mock' | 'persona' | 'stripe_identity' | 'veriff';
  verificationStatus: VerificationStatus;
  verificationUpdatedAt?: string;
  verificationFailureReason?: string;
  /**
   * Precise coordinates. Stored once because distance maths needs them; NEVER returned
   * to another family. Distance is exposed only as a band. See redaction.ts.
   */
  preciseLocation?: { lat: number; lng: number };
  /** Street address, if ever collected. Never projected. Not used by matching. */
  homeAddress?: string;
}

/** The social half of a parent — safe to show inside a connection. */
export interface ParentProfile {
  id: ParentId;
  accountId: AccountId;
  /** Display first name only. Never the legal name. */
  displayName: string;
  avatarColor: string;
  /** Short parent-written intro, moderated. */
  bio?: string;
  trustSignals: TrustSignal[];
  joinedAt: string;
}

export type FamilyRole = 'primary' | 'secondary';

/**
 * Join table, not a foreign key. A family already supports multiple parents; a parent
 * belonging to multiple families later needs no migration.
 */
export interface FamilyMembership {
  parentId: ParentId;
  familyId: FamilyId;
  role: FamilyRole;
  joinedAt: string;
}

// ---------------------------------------------------------------------------
// Children and interests
// ---------------------------------------------------------------------------

export type InterestCategory =
  | 'creative'
  | 'active'
  | 'games'
  | 'outdoors'
  | 'learning'
  | 'social';

export interface InterestDefinition {
  id: string;
  label: string;
  emoji: string;
  category: InterestCategory;
  /** Typical age range this interest is offered for. UI hint only, not a filter. */
  typicalAges: [number, number];
}

/** 1 = not important … 5 = extremely important. The parent's own weighting. */
export type Importance = 1 | 2 | 3 | 4 | 5;

export interface ChildInterest {
  interestId: string;
  /** How much the child likes it (1–5). Drives the other family's affinity score. */
  enthusiasm: Importance;
  /** How much the PARENT weights this when matching (1–5). Drives our own scoring. */
  importance: Importance;
}

/** How a child's name is shown to other families. Parent-controlled. */
export type NameDisclosure = 'hidden' | 'first_name' | 'nickname';

export interface Child {
  id: ChildId;
  familyId: FamilyId;
  firstName: string;
  nickname?: string;
  /** Stored as age in years. We deliberately do not store children's dates of birth. */
  age: number;
  pronouns?: string;
  interests: ChildInterest[];
  /** Free-text parent note, shown only to connected families. */
  notes?: string;
  /** Energy/temperament hints parents find genuinely useful when pairing. */
  temperament?: ChildTemperament;
  avatarColor: string;
  /** Photo is optional, off by default, and gated behind a separate consent step. */
  photoRef?: string;
}

export interface ChildTemperament {
  /** 1 = quiet/one-on-one … 5 = boisterous/group play. */
  energy: Importance;
  /** 1 = prefers familiar faces … 5 = jumps straight in with new children. */
  sociability: Importance;
}

// ---------------------------------------------------------------------------
// Family, preferences, availability, privacy
// ---------------------------------------------------------------------------

export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type TimeBlock = 'morning' | 'afternoon' | 'evening';

export interface AvailabilitySlot {
  day: DayOfWeek;
  block: TimeBlock;
}

export type PlaydateStyle =
  | 'parents_stay'
  | 'drop_off_ok'
  | 'public_places_only'
  | 'home_visits_ok'
  | 'small_groups'
  | 'structured_activities';

export interface FamilyPreferences {
  /** Maximum distance the family will travel, in km. A hard constraint, not a score. */
  maxTravelKm: number;
  /** Acceptable age gap either side of one of our children, in years. */
  ageFlexibilityYears: number;
  /** How the parent weights each matching dimension (1–5). */
  weights: {
    interests: Importance;
    age: Importance;
    distance: Importance;
    availability: Importance;
    style: Importance;
  };
  styles: PlaydateStyle[];
  /** Preferred activities for a first meeting. */
  preferredActivities: string[];
}

/** Coarse-to-fine disclosure of where a family is. Never an address. */
export type LocationDisclosure =
  | 'hidden'
  | 'general_area'
  | 'neighborhood'
  | 'approximate_distance';

export type PhotoDisclosure = 'hidden' | 'on_request' | 'connected_families';

export interface PrivacySettings {
  location: LocationDisclosure;
  childName: NameDisclosure;
  childPhotos: PhotoDisclosure;
  /** Show exact ages ("8") or bands ("7–9"). */
  childAges: 'exact' | 'range';
  /** Whether the family appears in discovery at all. */
  discoverable: boolean;
  /** Show availability as specific slots, or only as a coarse summary. */
  availabilityDetail: 'summary' | 'detailed';
  /** Whether parent bio is visible before connecting. */
  parentBio: 'connected_only' | 'discovery';
  /** Require the other family to be ID-verified before they can send a request. */
  requireVerifiedToRequest: boolean;
}

export interface Family {
  id: FamilyId;
  /** e.g. "The Cohen Family". Surname-level only — never a child's full name. */
  displayName: string;
  /** Coarse, human label: "Jerusalem area". Never derived from an address on the client. */
  generalArea: string;
  /** Finer label, disclosed only at `neighborhood` level or above. */
  neighborhood?: string;
  /** Approximate centroid used for distance bands. Never projected. */
  approxLocation: { lat: number; lng: number };
  about?: string;
  children: Child[];
  preferences: FamilyPreferences;
  availability: AvailabilitySlot[];
  privacy: PrivacySettings;
  createdAt: string;
  /** Denormalised from the primary parent for discovery badges. */
  verificationStatus: VerificationStatus;
  accountState: AccountState;
  /** Languages spoken at home — useful and parent-declared, shown at discovery tier. */
  languages: string[];
}

// ---------------------------------------------------------------------------
// Disclosure tiers and projections
// ---------------------------------------------------------------------------

/**
 * How much of a family the viewer is entitled to see. Rises only through consent.
 * `redaction.ts` is the single place this is applied.
 */
export enum DisclosureTier {
  /** Logged out or not permitted. Nothing is returned. */
  NONE = 0,
  /** Browsing. General area, child ages, interests, coarse availability. */
  DISCOVERY = 1,
  /** Mutually accepted. Chosen names, detail, photos if separately consented. */
  CONNECTED = 2,
  /** An agreed playdate exists. Meeting point and attendance details. */
  PLANNING = 3,
  /** The viewer's own family. Everything the family itself owns. */
  SELF = 4,
}

/**
 * How a projected age should be rendered. Structured rather than pre-formatted so the
 * projection carries no language — see `FamilyProjection`.
 */
export type AgeDisclosureView =
  | { kind: 'exact'; age: number }
  | { kind: 'range'; from: number; to: number };

/** A child as seen by another family. Has no field that could identify them offline. */
export interface ChildProjection {
  id: ChildId;
  /**
   * Respects `PrivacySettings.childName`. Either the name the parent chose to reveal,
   * or a positional placeholder the UI translates ("Child 1" / "ילד 1").
   */
  displayName: string | { placeholderIndex: number };
  /** Respects `PrivacySettings.childAges`. Formatted by the UI. */
  ageView: AgeDisclosureView;
  age: number;
  interests: Array<{ interestId: string; enthusiasm: Importance }>;
  temperament?: ChildTemperament;
  notes?: string;
  photoVisible: boolean;
  avatarColor: string;
}

/**
 * How much of a family's location the viewer may see, as data rather than a sentence.
 * `distanceBandKey` is a coarse band ("2–4 km"), never a figure — see redaction.ts.
 */
export type LocationView =
  | { kind: 'hidden' }
  | { kind: 'area'; area: string }
  | { kind: 'neighborhood'; area: string; neighborhood: string }
  | { kind: 'distance'; bandKey: string };

/** Coarse availability summary, as data. The UI phrases it. */
export interface AvailabilityView {
  scope: 'weekend' | 'weekday' | 'mixed' | 'none';
  blocks: TimeBlock[];
}

/**
 * A family as seen by another family. This type deliberately has NO address, phone,
 * email, legal name, date of birth, school, or coordinates. A UI bug cannot leak what
 * the object does not contain.
 *
 * It also carries no pre-rendered English: locations, ages and availability are
 * structured views that the UI formats in the reader's language. An API that returned
 * "Jerusalem area" would be an API that only works in one language.
 */
export interface FamilyProjection {
  id: FamilyId;
  displayName: string;
  location: LocationView;
  tier: DisclosureTier;
  children: ChildProjection[];
  childCount: number;
  verificationStatus: VerificationStatus;
  trustSignals: TrustSignal[];
  about?: string;
  parentDisplayName?: string;
  parentBio?: string;
  languages: string[];
  availabilitySummary: AvailabilityView;
  /** Only populated at CONNECTED tier or above. */
  availability?: AvailabilitySlot[];
  styles: PlaydateStyle[];
  /** Band key, never an exact figure. Resolves to e.g. "2–4 km". */
  distanceBandKey?: string;
  memberSince: string;
}

// ---------------------------------------------------------------------------
// Consent: requests, connections
// ---------------------------------------------------------------------------

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'deferred'
  | 'withdrawn'
  | 'expired';

export interface ConnectionRequest {
  id: RequestId;
  fromFamilyId: FamilyId;
  toFamilyId: FamilyId;
  /** Short, optional note. Rate-limited and scanned; not a messaging channel. */
  note?: string;
  status: RequestStatus;
  createdAt: string;
  respondedAt?: string;
  /** Snapshot of why the match was suggested, for the recipient's context. */
  matchSummary?: string;
}

export interface Connection {
  id: ConnectionId;
  familyIds: [FamilyId, FamilyId];
  createdAt: string;
  conversationId: ConversationId;
  state: 'active' | 'left' | 'blocked';
}

export interface Block {
  blockerFamilyId: FamilyId;
  blockedFamilyId: FamilyId;
  createdAt: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Messaging (parent-to-parent only)
// ---------------------------------------------------------------------------

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  /** Always a parent. There is no child sender — the type does not permit one. */
  senderParentId: ParentId;
  senderFamilyId: FamilyId;
  body: string;
  sentAt: string;
  /** Result of automated safety scanning. Advisory, never auto-punitive. */
  safetyFlags?: SafetyFlag[];
}

export interface SafetyFlag {
  kind:
    | 'contact_details_shared'
    | 'off_platform_move'
    | 'address_shared'
    | 'unsupervised_suggestion'
    | 'pressure_language'
    | 'child_direct_contact';
  severity: 'info' | 'caution' | 'high';
  /** Translation key — the prompt is shown to the sender in their own language. */
  messageKey: string;
}

export interface Conversation {
  id: ConversationId;
  connectionId: ConnectionId;
  familyIds: [FamilyId, FamilyId];
  messages: Message[];
  createdAt: string;
  lastMessageAt?: string;
  state: 'active' | 'left' | 'closed';
}

// ---------------------------------------------------------------------------
// PlayDates
// ---------------------------------------------------------------------------

export type PlayDateStatus =
  | 'proposed'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'completed';

export interface MeetingPlace {
  /** Parent-chosen label, e.g. "Gan Sacher — main playground". Never a home address. */
  label: string;
  /** Public venue category. Home visits are possible but flagged in the UI. */
  kind: 'playground' | 'park' | 'community_center' | 'pool' | 'cafe' | 'museum' | 'home' | 'other';
  area: string;
  isPublic: boolean;
}

export interface PlayDate {
  id: PlayDateId;
  connectionId: ConnectionId;
  familyIds: [FamilyId, FamilyId];
  proposedByFamilyId: FamilyId;
  activity: string;
  place: MeetingPlace;
  /** ISO date-time of the start. */
  startsAt: string;
  durationMinutes: number;
  status: PlayDateStatus;
  notes?: string;
  /** Per-family confirmation that an adult will be present for the whole visit. */
  adultPresent: Record<FamilyId, boolean>;
  /** Children attending, by family. Parent-selected. */
  attendees: Record<FamilyId, ChildId[]>;
  /** Optional: a trusted adult the parent chose to share the plan with. */
  sharedWith?: Array<{ name: string; sharedAt: string }>;
  createdAt: string;
  /** Post-meeting check-in, prompted after the fact. Private to the reporting family. */
  postMeetingFeedback?: Record<FamilyId, PostMeetingFeedback>;
}

export interface PostMeetingFeedback {
  wentWell: boolean;
  wouldMeetAgain: boolean;
  concerns?: string;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Reporting and moderation
// ---------------------------------------------------------------------------

export type ReportReason =
  | 'suspicious_behavior'
  | 'fake_identity'
  | 'harassment'
  | 'inappropriate_messages'
  | 'misrepresentation'
  | 'unwanted_contact'
  | 'safety_concern'
  | 'inappropriate_content'
  | 'child_safety_urgent';

export interface Report {
  id: ReportId;
  reporterFamilyId: FamilyId;
  reportedFamilyId: FamilyId;
  reason: ReportReason;
  details: string;
  /** Optional evidence pointers — message ids within a conversation the reporter is in. */
  evidenceMessageIds?: MessageId[];
  createdAt: string;
  caseId: CaseId;
}

export type CaseStatus = 'open' | 'investigating' | 'actioned' | 'dismissed';
export type CasePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ModerationCase {
  id: CaseId;
  reportedFamilyId: FamilyId;
  reportIds: ReportId[];
  status: CaseStatus;
  priority: CasePriority;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  notes: ModerationNote[];
  actions: ModerationAction[];
}

export interface ModerationNote {
  at: string;
  by: string;
  body: string;
}

export type ModerationActionKind =
  | 'no_action'
  | 'warning_issued'
  | 'require_reverification'
  | 'restrict_account'
  | 'suspend_account'
  | 'ban_account'
  | 'dismiss';

export interface ModerationAction {
  kind: ModerationActionKind;
  at: string;
  by: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  at: string;
  /** Who acted. An account id, or 'system'. */
  actor: string;
  actorRole: Role | 'system';
  action: string;
  /** What was touched. Never contains PII — see redactForLog(). */
  target?: string;
  /** Present when an elevated read was justified by an open case. */
  caseId?: CaseId;
  metadata?: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'connection_request'
  | 'request_accepted'
  | 'new_message'
  | 'playdate_proposed'
  | 'playdate_confirmed'
  | 'playdate_reminder'
  | 'verification_update'
  | 'safety_notice'
  | 'moderation_update';

/**
 * An in-app notification.
 *
 * Keys and interpolation values, never sentences — the same rule the matching
 * scorers and the API's `NextStep` follow. A stored English string here is a
 * notification a Hebrew-reading parent receives in English, and notifications
 * outlive the request that created them, so there is no later opportunity to
 * pick a language for them.
 *
 * `titleVars` carries data the dictionary interpolates: a family display name,
 * a place label, a count. Those are values, not prose.
 */
export interface AppNotification {
  id: string;
  familyId: FamilyId;
  kind: NotificationKind;
  titleKey: string;
  titleVars?: Record<string, string | number>;
  bodyKey: string;
  bodyVars?: Record<string, string | number>;
  /**
   * ISO timestamp the body refers to — a playdate's start, not the
   * notification's own time. Formatted by the reader's locale, the same way
   * `TrustSignal.detailDate` is, because a date baked into a stored string is
   * a date in whoever-wrote-the-code's calendar and language.
   */
  bodyDate?: string;
  createdAt: string;
  read: boolean;
  /** In-app route this notification points at. */
  href?: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Note the shape: a session identifies an ACCOUNT and a PARENT. There is no child
 * variant, and there is no way to construct one. This is the structural guarantee that
 * children cannot act on the platform.
 */
export interface Session {
  accountId: AccountId;
  parentId: ParentId;
  familyId: FamilyId | null;
  role: Role;
  issuedAt: number;
  expiresAt: number;
  deviceLabel: string;
}

export interface DeviceSession {
  id: string;
  label: string;
  lastSeenAt: string;
  current: boolean;
  location: string;
}
