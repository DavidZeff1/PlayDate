import {

  type Account,
  type AppNotification,
  type AvailabilitySlot,
  type Child,
  type ConnectionRequest,
  type Family,
  type FamilyPreferences,
  type FamilyProjection,
  type MeetingPlace,
  type Message,
  type ModerationActionKind,
  type ModerationCase,

  type PlayDate,
  type PostMeetingFeedback,
  type PrivacySettings,
  type Report,
  type ReportReason,
  type Session,
  type DeviceSession,
} from '../../domain/types';
import { projectFamily } from '../../domain/privacy/redaction';
import { haversineKm, matchFamilies, rankFamilies } from '../../domain/matching/engine';
import { scanMessage } from '../../domain/safety/contentScan';
import { buildTrustSignals } from '../../domain/trust/signals';
import { sanitiseText } from '../../domain/validation';
import type {
  AdminOverview,
  ChildInput,
  ConversationView,
  DashboardSummary,
  DiscoveryFilters,
  DiscoveryResult,
  FamilyProfileInput,
  NextStep,
  PlayDateApi,
  PlayDateView,
  RequestView,
  SignUpInput,
  VerificationState,
} from '../api';
import {
  RateLimiter,
  RateLimitError,
} from '../security/rateLimit';
import {
  AuthorizationError,
  assertAccountInGoodStanding,
  assertCanDiscover,

  assertSession,
  resolveDisclosureTier,
} from '../security/guards';
import {
  audit,
  confirmedPlaydateBetween,
  connectionBetween,
  findAccount,
  findFamily,
  findIdentity,
  findParentProfile,
  getState,
  isBlockedEitherWay,
  loadSession,
  mutate,
  newId,
  notify,
  otherFamilyId,
  persist,
  primaryParentOfFamily,
  resetState,
  saveSession,
  SESSION_IDLE_MS,
  touchSession,
} from './store';

/** Simulated network latency, so loading states in the UI are real. */
const LATENCY_MS = 120;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Mock implementation of `PlayDateApi`.
 *
 * Structure to note: every public method starts by resolving the session and, where
 * relevant, consuming a rate-limit token and asserting authorization — before touching
 * data. That ordering is the point. It mirrors what a real controller does, so the
 * checks are not something a future HTTP implementation has to remember to add.
 */
export class MockPlayDateApi implements PlayDateApi {
  private session: Session | null = loadSession();
  private limiter = new RateLimiter();

  // -- internals ----------------------------------------------------------

  private requireSession(): Session {
    assertSession(this.session);
    this.session = touchSession(this.session);
    return this.session;
  }

  private requireFamily(): { session: Session; family: Family; account: Account } {
    const session = this.requireSession();
    const account = findAccount(session.accountId);
    if (!account) throw new AuthorizationError('Account not found.', 'unauthenticated');
    if (!session.familyId) throw new AuthorizationError('Create your family profile first.', 'no_family');
    const family = findFamily(session.familyId);
    if (!family) throw new AuthorizationError('Create your family profile first.', 'no_family');
    return { session, family, account };
  }

  /** Resolve how much of `targetId` this viewer may see, then project accordingly. */
  private project(viewerFamily: Family | null, targetId: string): FamilyProjection | null {
    const target = findFamily(targetId);
    if (!target) return null;

    const viewerId = viewerFamily?.id ?? null;
    const account = this.session ? findAccount(this.session.accountId) : null;

    let canDiscover = false;
    if (account && viewerFamily) {
      try {
        assertCanDiscover(account, viewerFamily);
        canDiscover = true;
      } catch {
        canDiscover = false;
      }
    }

    const tier = resolveDisclosureTier({
      viewerFamilyId: viewerId,
      targetFamilyId: targetId,
      hasConnection: viewerId ? Boolean(connectionBetween(viewerId, targetId)) : false,
      hasConfirmedPlaydate: viewerId ? Boolean(confirmedPlaydateBetween(viewerId, targetId)) : false,
      canDiscover,
      isBlockedEitherWay: viewerId ? isBlockedEitherWay(viewerId, targetId) : false,
    });

    const distanceKm = viewerFamily
      ? haversineKm(viewerFamily.approxLocation, target.approxLocation)
      : undefined;

    return projectFamily(target, {
      tier,
      distanceKm,
      parent: primaryParentOfFamily(targetId),
      photoConsentGranted: viewerId
        ? getState().photoConsents.includes(`${viewerId}->${targetId}`)
        : false,
    });
  }

  private relationshipTo(myFamilyId: string, otherId: string): DiscoveryResult['relationship'] {
    const s = getState();
    if (connectionBetween(myFamilyId, otherId)) return 'connected';
    const outgoing = s.requests.find(
      (r) => r.fromFamilyId === myFamilyId && r.toFamilyId === otherId && r.status === 'pending',
    );
    if (outgoing) return 'request_sent';
    const incoming = s.requests.find(
      (r) => r.fromFamilyId === otherId && r.toFamilyId === myFamilyId && r.status === 'pending',
    );
    if (incoming) return 'request_received';
    const declined = s.requests.find(
      (r) =>
        ((r.fromFamilyId === myFamilyId && r.toFamilyId === otherId) ||
          (r.fromFamilyId === otherId && r.toFamilyId === myFamilyId)) &&
        r.status === 'declined',
    );
    return declined ? 'declined' : 'none';
  }

  private blockedIdsFor(familyId: string): Set<string> {
    return new Set(
      getState()
        .blocks.filter((b) => b.blockerFamilyId === familyId || b.blockedFamilyId === familyId)
        .map((b) => (b.blockerFamilyId === familyId ? b.blockedFamilyId : b.blockerFamilyId)),
    );
  }

  private refreshTrustSignals(parentId: string): void {
    const s = getState();
    const profile = s.parentProfiles.find((p) => p.id === parentId);
    const account = s.accounts.find((a) => a.id === profile?.accountId);
    const identity = s.parentIdentities.find((p) => p.parentId === parentId);
    const membership = s.memberships.find((m) => m.parentId === parentId);
    const family = membership ? findFamily(membership.familyId) : undefined;
    if (!profile || !account || !identity) return;

    const completed = s.playdates.filter(
      (p) => p.status === 'completed' && family && p.familyIds.includes(family.id),
    ).length;
    const ageMonths = Math.max(
      0,
      Math.round((Date.now() - new Date(profile.joinedAt).getTime()) / (30 * 86_400_000)),
    );
    const secondaryVerified = s.memberships.some(
      (m) => m.familyId === membership?.familyId && m.role === 'secondary',
    );

    profile.trustSignals = buildTrustSignals({
      emailVerified: account.emailVerified,
      phoneVerified: account.phoneVerified,
      idVerification: identity.verificationStatus,
      twoFactorEnabled: account.twoFactorEnabled,
      secondaryParentVerified: secondaryVerified,
      profileComplete: Boolean(family && family.children.length > 0 && family.availability.length > 0),
      accountAgeMonths: ageMonths,
      completedPlaydates: completed,
      upheldReports: 0,
      joinedAt: profile.joinedAt,
    });
    persist();
  }

  /** Keep the denormalised badges on `Family` in step with the identity record. */
  private syncFamilyStatus(familyId: string): void {
    const s = getState();
    const family = findFamily(familyId);
    const membership = s.memberships.find((m) => m.familyId === familyId && m.role === 'primary');
    const identity = membership ? findIdentity(membership.parentId) : undefined;
    const account = s.accounts.find((a) => a.id === (membership ? findParentProfile(membership.parentId)?.accountId : ''));
    if (!family || !identity || !account) return;
    family.verificationStatus = identity.verificationStatus;
    family.accountState = account.state;
    persist();
  }

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  async signUp(input: SignUpInput): Promise<{ session: Session }> {
    const email = input.email.trim().toLowerCase();
    if (getState().accounts.some((a) => a.email.toLowerCase() === email)) {
      // Deliberately explicit here because this is a signup form, where a generic error
      // would strand the user. Sign-IN, by contrast, must never reveal which half was
      // wrong — see signIn().
      throw new ValidationError('An account already exists with that email address.', 'email');
    }

    return mutate((s) => {
      const accountId = newId('acc');
      const parentId = newId('par');
      const now = new Date().toISOString();

      s.accounts.push({
        id: accountId,
        email,
        // Prototype only. A real client never sees, sends or stores a password hash;
        // the server hashes with Argon2id and the client sends the password once, over
        // TLS, to an endpoint that never logs it.
        passwordHash: `mock$${input.password.length}`,
        phone: input.phone,
        role: 'parent',
        state: 'verification_required',
        emailVerified: false,
        phoneVerified: false,
        twoFactorEnabled: false,
        createdAt: now,
      });

      s.parentProfiles.push({
        id: parentId,
        accountId,
        displayName: '',
        avatarColor: '#7C6BF0',
        joinedAt: now,
        trustSignals: [],
      });

      s.parentIdentities.push({
        parentId,
        legalFirstName: '',
        legalLastName: '',
        dateOfBirth: '',
        verificationStatus: 'unstarted',
      });

      const session: Session = {
        accountId,
        parentId,
        familyId: null,
        role: 'parent',
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_IDLE_MS,
        deviceLabel: 'This browser',
      };
      this.session = session;
      saveSession(session);

      audit({ actor: accountId, actorRole: 'parent', action: 'account.created' });
      return delay({ session });
    });
  }

  async signIn(email: string, password: string): Promise<{ session: Session }> {
    const normalised = email.trim().toLowerCase();
    // Rate limit keyed on the submitted email, so one attacker cannot lock out an
    // unrelated account by guessing against it from elsewhere... and so credential
    // stuffing against many accounts still costs them.
    this.limiter.consume(normalised || 'anon', 'login');

    const account = getState().accounts.find((a) => a.email.toLowerCase() === normalised);

    // One message for every failure mode. Distinguishing "no such account" from "wrong
    // password" hands an attacker a free account-enumeration oracle — on a platform
    // where merely confirming someone is a parent here is sensitive.
    if (!account || password.length < 1) {
      audit({ actor: normalised || 'unknown', actorRole: 'system', action: 'auth.failed' });
      throw new AuthorizationError('Email or password is incorrect.', 'bad_credentials');
    }

    if (account.state === 'banned' || account.state === 'suspended') {
      throw new AuthorizationError('This account is not available. Please contact support.', account.state);
    }

    const membership = getState().memberships.find((m) => {
      const profile = findParentProfile(m.parentId);
      return profile?.accountId === account.id;
    });

    const session: Session = {
      accountId: account.id,
      parentId: membership?.parentId ?? '',
      familyId: membership?.familyId ?? null,
      role: account.role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION_IDLE_MS,
      deviceLabel: 'This browser',
    };
    this.session = session;
    saveSession(session);
    account.lastLoginAt = new Date().toISOString();
    persist();

    audit({ actor: account.id, actorRole: account.role, action: 'auth.signin' });
    return delay({ session });
  }

  /** Prototype convenience: sign in as the seeded Cohen family. */
  async signInAsDemo(): Promise<{ session: Session }> {
    const session: Session = {
      accountId: 'acc_cohen',
      parentId: 'par_cohen',
      familyId: 'fam_cohen',
      role: 'parent',
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION_IDLE_MS,
      deviceLabel: 'This browser',
    };
    this.session = session;
    saveSession(session);
    audit({ actor: 'acc_cohen', actorRole: 'parent', action: 'auth.demo_signin' });
    return delay({ session });
  }

  async signOut(): Promise<void> {
    if (this.session) {
      audit({ actor: this.session.accountId, actorRole: this.session.role, action: 'auth.signout' });
    }
    this.session = null;
    saveSession(null);
    return delay(undefined, 60);
  }

  async getSession(): Promise<Session | null> {
    if (this.session && Date.now() > this.session.expiresAt) {
      this.session = null;
      saveSession(null);
    }
    return delay(this.session, 20);
  }

  async getDeviceSessions(): Promise<DeviceSession[]> {
    this.requireSession();
    return delay(getState().deviceSessions);
  }

  async revokeDeviceSession(id: string): Promise<void> {
    const session = this.requireSession();
    mutate((s) => {
      s.deviceSessions = s.deviceSessions.filter((d) => d.id !== id || d.current);
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'session.revoked', target: id });
    return delay(undefined);
  }

  // -----------------------------------------------------------------------
  // Verification
  // -----------------------------------------------------------------------

  async sendEmailCode(): Promise<{ hint: string }> {
    const session = this.requireSession();
    this.limiter.consume(session.accountId, 'verification_code');
    return mutate((s) => {
      // The prototype shows the code because there is no email provider. A real system
      // sends it out-of-band and NEVER returns it to the client.
      const code = '123456';
      s.pendingCodes[`email:${session.accountId}`] = code;
      audit({ actor: session.accountId, actorRole: session.role, action: 'verification.email_code_sent' });
      return delay({ hint: code });
    });
  }

  async sendPhoneCode(): Promise<{ hint: string }> {
    const session = this.requireSession();
    this.limiter.consume(session.accountId, 'verification_code');
    return mutate((s) => {
      const code = '654321';
      s.pendingCodes[`phone:${session.accountId}`] = code;
      audit({ actor: session.accountId, actorRole: session.role, action: 'verification.phone_code_sent' });
      return delay({ hint: code });
    });
  }

  async confirmEmailCode(code: string): Promise<void> {
    const session = this.requireSession();
    this.limiter.consume(session.accountId, 'verification_code');
    const expected = getState().pendingCodes[`email:${session.accountId}`] ?? '123456';
    if (code.replace(/\s/g, '') !== expected) throw new ValidationError('That code is not correct.', 'code');
    mutate((s) => {
      const account = s.accounts.find((a) => a.id === session.accountId);
      if (account) account.emailVerified = true;
    });
    this.refreshTrustSignals(session.parentId);
    audit({ actor: session.accountId, actorRole: session.role, action: 'verification.email_confirmed' });
    return delay(undefined);
  }

  async confirmPhoneCode(code: string): Promise<void> {
    const session = this.requireSession();
    this.limiter.consume(session.accountId, 'verification_code');
    const expected = getState().pendingCodes[`phone:${session.accountId}`] ?? '654321';
    if (code.replace(/\s/g, '') !== expected) throw new ValidationError('That code is not correct.', 'code');
    mutate((s) => {
      const account = s.accounts.find((a) => a.id === session.accountId);
      if (account) account.phoneVerified = true;
    });
    this.refreshTrustSignals(session.parentId);
    audit({ actor: session.accountId, actorRole: session.role, action: 'verification.phone_confirmed' });
    return delay(undefined);
  }

  async setTwoFactor(enabled: boolean): Promise<void> {
    const session = this.requireSession();
    mutate((s) => {
      const account = s.accounts.find((a) => a.id === session.accountId);
      if (account) account.twoFactorEnabled = enabled;
    });
    this.refreshTrustSignals(session.parentId);
    audit({
      actor: session.accountId,
      actorRole: session.role,
      action: enabled ? 'security.2fa_enabled' : 'security.2fa_disabled',
    });
    return delay(undefined);
  }

  /**
   * Begin identity verification.
   *
   * In production this hands off to a provider (Persona / Stripe Identity / Veriff):
   * the parent's ID document and selfie go to the PROVIDER, never to us, and we store
   * only an opaque reference and a decision. That shape is preserved here — note that
   * this method takes name and date of birth but never a document, and stores only
   * `verificationProviderRef`.
   */
  async startIdentityVerification(input: {
    legalFirstName: string;
    legalLastName: string;
    dateOfBirth: string;
  }): Promise<{ status: Family['verificationStatus'] }> {
    const session = this.requireSession();
    return mutate((s) => {
      const identity = s.parentIdentities.find((p) => p.parentId === session.parentId);
      if (!identity) throw new NotFoundError('Parent record not found.');

      identity.legalFirstName = sanitiseText(input.legalFirstName, 100);
      identity.legalLastName = sanitiseText(input.legalLastName, 100);
      identity.dateOfBirth = input.dateOfBirth;
      identity.verificationStatus = 'pending';
      identity.verificationProvider = 'mock';
      identity.verificationProviderRef = newId('mockref');
      identity.verificationUpdatedAt = new Date().toISOString();

      // Audit records that verification began — never the identity data itself.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'verification.identity_started',
        metadata: { provider: 'mock' },
      });

      if (session.familyId) this.syncFamilyStatus(session.familyId);
      return delay({ status: 'pending' as const });
    });
  }

  async resolveMockVerification(outcome: 'verified' | 'failed'): Promise<void> {
    const session = this.requireSession();
    mutate((s) => {
      const identity = s.parentIdentities.find((p) => p.parentId === session.parentId);
      if (!identity) throw new NotFoundError('Parent record not found.');
      identity.verificationStatus = outcome;
      identity.verificationUpdatedAt = new Date().toISOString();
      identity.verificationFailureReason =
        outcome === 'failed' ? 'The document could not be read clearly.' : undefined;

      const account = s.accounts.find((a) => a.id === session.accountId);
      if (account) account.state = outcome === 'verified' ? 'active' : 'verification_required';
    });
    if (session.familyId) this.syncFamilyStatus(session.familyId);
    this.refreshTrustSignals(session.parentId);
    audit({
      actor: 'system',
      actorRole: 'system',
      action: 'verification.identity_resolved',
      target: session.parentId,
      metadata: { outcome, provider: 'mock' },
    });
    return delay(undefined, 400);
  }

  async getVerificationState(): Promise<VerificationState> {
    const session = this.requireSession();
    const account = findAccount(session.accountId);
    const identity = findIdentity(session.parentId);
    if (!account) throw new NotFoundError();
    return delay({
      emailVerified: account.emailVerified,
      phoneVerified: account.phoneVerified,
      twoFactorEnabled: account.twoFactorEnabled,
      identityStatus: identity?.verificationStatus ?? 'unstarted',
      identityUpdatedAt: identity?.verificationUpdatedAt,
      failureReason: identity?.verificationFailureReason,
      provider: identity?.verificationProvider,
      isMockProvider: true,
    });
  }

  // -----------------------------------------------------------------------
  // Family
  // -----------------------------------------------------------------------

  async createFamily(input: FamilyProfileInput): Promise<Family> {
    const session = this.requireSession();
    if (session.familyId) throw new ValidationError('You already have a family profile.');

    return mutate((s) => {
      const id = newId('fam');
      const now = new Date().toISOString();
      const identity = s.parentIdentities.find((p) => p.parentId === session.parentId);

      const family: Family = {
        id,
        displayName: sanitiseText(input.displayName, 80),
        generalArea: sanitiseText(input.generalArea, 80),
        neighborhood: input.neighborhood ? sanitiseText(input.neighborhood, 80) : undefined,
        // Prototype: a coarse default centroid. Production derives this from a
        // geocoded area — never from a precise address entered by the parent.
        approxLocation: { lat: 31.7683, lng: 35.2137 },
        about: input.about ? sanitiseText(input.about, 600) : undefined,
        children: [],
        preferences: {
          maxTravelKm: 8,
          ageFlexibilityYears: 2,
          weights: { interests: 4, age: 4, distance: 3, availability: 3, style: 3 },
          styles: ['parents_stay', 'public_places_only'],
          preferredActivities: ['playground', 'park'],
        },
        availability: [],
        privacy: {
          // Privacy defaults are the most protective option that still lets the product
          // work. Photos off, general area only, verified-only requests.
          location: 'general_area',
          childName: 'first_name',
          childPhotos: 'hidden',
          childAges: 'exact',
          discoverable: true,
          availabilityDetail: 'summary',
          parentBio: 'connected_only',
          requireVerifiedToRequest: true,
        },
        createdAt: now,
        verificationStatus: identity?.verificationStatus ?? 'unstarted',
        accountState: 'verification_required',
        languages: input.languages,
      };

      s.families.push(family);
      s.memberships.push({
        parentId: session.parentId,
        familyId: id,
        role: 'primary',
        joinedAt: now,
      });

      this.session = { ...session, familyId: id };
      saveSession(this.session);

      audit({ actor: session.accountId, actorRole: session.role, action: 'family.created', target: id });
      return delay(family);
    });
  }

  async getMyFamily(): Promise<Family | null> {
    const session = this.requireSession();
    if (!session.familyId) return delay(null, 20);
    return delay(findFamily(session.familyId) ?? null, 20);
  }

  async updateFamilyProfile(input: Partial<FamilyProfileInput>): Promise<Family> {
    const { session, family } = this.requireFamily();
    return mutate(() => {
      if (input.displayName !== undefined) family.displayName = sanitiseText(input.displayName, 80);
      if (input.generalArea !== undefined) family.generalArea = sanitiseText(input.generalArea, 80);
      if (input.neighborhood !== undefined) family.neighborhood = sanitiseText(input.neighborhood, 80);
      if (input.about !== undefined) family.about = sanitiseText(input.about, 600);
      if (input.languages !== undefined) family.languages = input.languages;
      audit({ actor: session.accountId, actorRole: session.role, action: 'family.updated', target: family.id });
      return delay(family);
    });
  }

  async updatePreferences(prefs: Partial<FamilyPreferences>): Promise<Family> {
    const { session, family } = this.requireFamily();
    return mutate(() => {
      family.preferences = {
        ...family.preferences,
        ...prefs,
        weights: { ...family.preferences.weights, ...(prefs.weights ?? {}) },
      };
      audit({ actor: session.accountId, actorRole: session.role, action: 'family.preferences_updated', target: family.id });
      return delay(family);
    });
  }

  async updateAvailability(slots: AvailabilitySlot[]): Promise<Family> {
    const { session, family } = this.requireFamily();
    return mutate(() => {
      family.availability = slots;
      this.refreshTrustSignals(session.parentId);
      audit({ actor: session.accountId, actorRole: session.role, action: 'family.availability_updated', target: family.id });
      return delay(family);
    });
  }

  async updatePrivacy(privacy: Partial<PrivacySettings>): Promise<Family> {
    const { session, family } = this.requireFamily();
    return mutate(() => {
      family.privacy = { ...family.privacy, ...privacy };
      // Privacy changes are audited specifically: a parent should be able to ask us
      // what their settings were on a given day, and we should be able to answer.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'privacy.updated',
        target: family.id,
        metadata: Object.fromEntries(
          Object.entries(privacy).map(([k, v]) => [k, String(v)]),
        ),
      });
      return delay(family);
    });
  }

  async acceptSafetyGuidelines(): Promise<void> {
    const session = this.requireSession();
    mutate((s) => {
      const account = s.accounts.find((a) => a.id === session.accountId);
      if (account) account.safetyGuidelinesAcceptedAt = new Date().toISOString();
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'safety.guidelines_accepted' });
    return delay(undefined, 60);
  }

  // -----------------------------------------------------------------------
  // Children
  // -----------------------------------------------------------------------

  async addChild(input: ChildInput): Promise<Child> {
    const { session, family } = this.requireFamily();
    if (family.children.length >= 8) throw new ValidationError('You can add up to 8 children.');

    return mutate(() => {
      const child: Child = {
        id: newId('chi'),
        familyId: family.id,
        firstName: sanitiseText(input.firstName, 40),
        nickname: input.nickname ? sanitiseText(input.nickname, 40) : undefined,
        age: input.age,
        pronouns: input.pronouns,
        interests: input.interests,
        notes: input.notes ? sanitiseText(input.notes, 400) : undefined,
        temperament: input.temperament,
        avatarColor: ['#7C6BF0', '#E08A5C', '#3FA796', '#D96A8B', '#5A8FD6'][
          family.children.length % 5
        ],
      };
      family.children.push(child);
      this.refreshTrustSignals(session.parentId);
      // Note the audit metadata: the child's id and age band, never their name.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'child.added',
        target: child.id,
        metadata: { familyId: family.id },
      });
      return delay(child);
    });
  }

  async updateChild(childId: string, input: Partial<ChildInput>): Promise<Child> {
    const { session, family } = this.requireFamily();
    return mutate(() => {
      const child = family.children.find((c) => c.id === childId);
      if (!child) throw new NotFoundError('Child not found.');
      if (input.firstName !== undefined) child.firstName = sanitiseText(input.firstName, 40);
      if (input.nickname !== undefined) child.nickname = sanitiseText(input.nickname, 40);
      if (input.age !== undefined) child.age = input.age;
      if (input.pronouns !== undefined) child.pronouns = input.pronouns;
      if (input.notes !== undefined) child.notes = sanitiseText(input.notes, 400);
      if (input.interests !== undefined) child.interests = input.interests;
      if (input.temperament !== undefined) child.temperament = input.temperament;
      audit({ actor: session.accountId, actorRole: session.role, action: 'child.updated', target: childId });
      return delay(child);
    });
  }

  async removeChild(childId: string): Promise<void> {
    const { session, family } = this.requireFamily();
    mutate(() => {
      family.children = family.children.filter((c) => c.id !== childId);
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'child.removed', target: childId });
    return delay(undefined);
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  async discoverFamilies(filters: DiscoveryFilters = {}): Promise<DiscoveryResult[]> {
    const { session, family, account } = this.requireFamily();
    // THE gate: an unverified adult never browses other families' children.
    assertCanDiscover(account, family);
    this.limiter.consume(session.accountId, 'discovery_page');

    const s = getState();
    const blocked = this.blockedIdsFor(family.id);

    const ranked = rankFamilies(family, s.families, { blockedFamilyIds: blocked });

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
        const km = haversineKm(family.approxLocation, candidate.approxLocation);
        if (km > filters.maxDistanceKm) continue;
      }

      if (filters.availableOn?.length) {
        const wanted = new Set(filters.availableOn.map((a) => `${a.day}:${a.block}`));
        const overlaps = candidate.availability.some((a) => wanted.has(`${a.day}:${a.block}`));
        if (!overlaps) continue;
      }

      const projection = this.project(family, candidate.id);
      if (!projection) continue;

      results.push({
        projection,
        match: result,
        relationship: this.relationshipTo(family.id, candidate.id),
      });
    }

    if (filters.sort === 'newest') {
      results.sort(
        (a, b) => new Date(b.projection.memberSince).getTime() - new Date(a.projection.memberSince).getTime(),
      );
    }

    // Audit records that discovery ran and how many results — never who was seen.
    audit({
      actor: session.accountId,
      actorRole: session.role,
      action: 'discovery.searched',
      metadata: { resultCount: results.length },
    });

    return delay(results);
  }

  async excludedFamilies(): Promise<
    Array<{ displayName: string; reasonKey: string; reasonVars?: Record<string, string | number> }>
  > {
    const { family, account } = this.requireFamily();
    assertCanDiscover(account, family);
    const blocked = this.blockedIdsFor(family.id);
    const all = rankFamilies(family, getState().families, {
      blockedFamilyIds: blocked,
      includeExcluded: true,
    });
    return delay(
      all
        .filter((r) => r.result.excluded && r.result.exclusionKey !== 'exclude.blocked')
        .map((r) => ({
          // Only the family's display name and the reason — no projection is built for
          // a family the viewer is not entitled to see. The reason travels as a key so
          // the UI renders it in the reader's language.
          displayName: r.family.displayName,
          reasonKey: r.result.exclusionKey ?? 'exclude.notAvailable',
          reasonVars: r.result.exclusionVars,
        })),
    );
  }

  async getFamilyProjection(familyId: string): Promise<DiscoveryResult | null> {
    const { family, account } = this.requireFamily();
    const target = findFamily(familyId);
    if (!target) return delay(null);

    // A connected family stays visible even if the viewer's own verification lapses,
    // so an expiring check never strands an in-flight conversation.
    const connected = Boolean(connectionBetween(family.id, familyId));
    if (!connected) assertCanDiscover(account, family);

    const projection = this.project(family, familyId);
    if (!projection) return delay(null);

    const match = matchFamilies(family, target, {
      distanceKm: haversineKm(family.approxLocation, target.approxLocation),
      blockedFamilyIds: this.blockedIdsFor(family.id),
    });

    return delay({
      projection,
      match,
      relationship: this.relationshipTo(family.id, familyId),
    });
  }

  async getDashboard(): Promise<DashboardSummary> {
    const { session, family, account } = this.requireFamily();
    const s = getState();
    const parent = findParentProfile(session.parentId);
    if (!parent) throw new NotFoundError();

    const incoming = s.requests.filter((r) => r.toFamilyId === family.id && r.status === 'pending');
    const outgoing = s.requests.filter((r) => r.fromFamilyId === family.id && r.status === 'pending');

    let matchCount = 0;
    try {
      assertCanDiscover(account, family);
      matchCount = rankFamilies(family, s.families, {
        blockedFamilyIds: this.blockedIdsFor(family.id),
      }).length;
    } catch {
      matchCount = 0;
    }

    const unreadMessages = s.conversations
      .filter((c) => c.familyIds.includes(family.id) && c.state === 'active')
      .reduce((total, c) => {
        const marker = s.readMarkers[`${family.id}:${c.id}`];
        const since = marker ? new Date(marker).getTime() : 0;
        return (
          total +
          c.messages.filter((m) => m.senderFamilyId !== family.id && new Date(m.sentAt).getTime() > since)
            .length
        );
      }, 0);

    const upcoming = s.playdates
      .filter(
        (p) =>
          p.familyIds.includes(family.id) &&
          (p.status === 'confirmed' || p.status === 'proposed') &&
          new Date(p.startsAt).getTime() > Date.now() - 3_600_000,
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return delay({
      family,
      parent,
      account,
      matchCount,
      pendingIncomingRequests: incoming.length,
      pendingOutgoingRequests: outgoing.length,
      unreadMessages,
      upcomingPlaydates: upcoming,
      unreadNotifications: s.notifications.filter((n) => n.familyId === family.id && !n.read).length,
      nextSteps: buildNextSteps({ family, account, incoming: incoming.length, matchCount, upcoming }),
    });
  }

  // -----------------------------------------------------------------------
  // Consent
  // -----------------------------------------------------------------------

  async sendConnectionRequest(toFamilyId: string, note?: string): Promise<ConnectionRequest> {
    const { session, family, account } = this.requireFamily();
    assertCanDiscover(account, family);
    this.limiter.consume(session.accountId, 'connection_request');

    const target = findFamily(toFamilyId);
    if (!target) throw new NotFoundError('That family could not be found.');
    if (toFamilyId === family.id) throw new ValidationError('You cannot send a request to your own family.');
    if (isBlockedEitherWay(family.id, toFamilyId)) {
      // Deliberately the same message a non-existent family would produce. Telling
      // someone they have been blocked invites retaliation and account-hopping.
      throw new NotFoundError('That family could not be found.');
    }
    if (connectionBetween(family.id, toFamilyId)) {
      throw new ValidationError('You are already connected with this family.');
    }

    const s = getState();
    const existing = s.requests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromFamilyId === family.id && r.toFamilyId === toFamilyId) ||
          (r.fromFamilyId === toFamilyId && r.toFamilyId === family.id)),
    );
    if (existing) throw new ValidationError('There is already a pending request with this family.');

    // The recipient's own rule: they can require ID verification before being contacted.
    if (target.privacy.requireVerifiedToRequest && family.verificationStatus !== 'verified') {
      throw new AuthorizationError(
        'This family only accepts requests from ID-verified parents.',
        'verification_required',
      );
    }

    const match = matchFamilies(family, target, {
      distanceKm: haversineKm(family.approxLocation, target.approxLocation),
    });

    return mutate(() => {
      const request: ConnectionRequest = {
        id: newId('req'),
        fromFamilyId: family.id,
        toFamilyId,
        // A request note is a one-shot, length-capped message — not a channel. Someone
        // who is declined cannot keep writing.
        note: note ? sanitiseText(note, 400) : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
        // The summary is stored as keys, not a sentence: the recipient may read a
        // different language from the sender.
        matchSummary: JSON.stringify(
          match.reasons
            .filter((r) => r.tone === 'positive')
            .slice(0, 3)
            .map((r) => ({ key: r.key, vars: r.vars })),
        ),
      };
      s.requests.push(request);

      notify({
        familyId: toFamilyId,
        kind: 'connection_request',
        title: `${family.displayName} would like to connect`,
        body: request.matchSummary || 'You can accept, decline, or decide later.',
        href: '/app/requests',
      });

      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'request.sent',
        target: toFamilyId,
      });
      return delay(request);
    });
  }

  async respondToRequest(
    requestId: string,
    response: 'accepted' | 'declined' | 'deferred',
  ): Promise<ConnectionRequest> {
    const { session, family } = this.requireFamily();

    return mutate((s) => {
      const request = s.requests.find((r) => r.id === requestId);
      if (!request) throw new NotFoundError('Request not found.');
      if (request.toFamilyId !== family.id) {
        throw new AuthorizationError('You can only respond to requests sent to you.');
      }
      if (request.status !== 'pending') throw new ValidationError('This request has already been answered.');

      request.status = response;
      request.respondedAt = new Date().toISOString();

      if (response === 'accepted') {
        const conversationId = newId('conv');
        const connectionId = newId('conn');
        s.connections.push({
          id: connectionId,
          familyIds: [request.fromFamilyId, request.toFamilyId],
          createdAt: new Date().toISOString(),
          conversationId,
          state: 'active',
        });
        s.conversations.push({
          id: conversationId,
          connectionId,
          familyIds: [request.fromFamilyId, request.toFamilyId],
          messages: [],
          createdAt: new Date().toISOString(),
          state: 'active',
        });

        notify({
          familyId: request.fromFamilyId,
          kind: 'request_accepted',
          title: `${family.displayName} accepted your request`,
          body: 'You can now message each other and plan a playdate.',
          href: '/app/messages',
        });
      }

      // Declining and deferring are deliberately silent. The other family sees only
      // that the request is no longer pending — never that they were turned down, and
      // never why. Declining must carry no social cost.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: `request.${response}`,
        target: request.fromFamilyId,
      });

      return delay(request);
    });
  }

  async withdrawRequest(requestId: string): Promise<void> {
    const { session, family } = this.requireFamily();
    mutate((s) => {
      const request = s.requests.find((r) => r.id === requestId);
      if (!request) throw new NotFoundError('Request not found.');
      if (request.fromFamilyId !== family.id) throw new AuthorizationError('Not your request.');
      request.status = 'withdrawn';
      request.respondedAt = new Date().toISOString();
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'request.withdrawn', target: requestId });
    return delay(undefined);
  }

  async getIncomingRequests(): Promise<RequestView[]> {
    const { family } = this.requireFamily();
    const s = getState();
    const views: RequestView[] = [];

    for (const request of s.requests.filter((r) => r.toFamilyId === family.id && r.status === 'pending')) {
      const projection = this.project(family, request.fromFamilyId);
      if (!projection) continue;
      const other = findFamily(request.fromFamilyId);
      views.push({
        request,
        otherFamily: projection,
        match: other
          ? matchFamilies(family, other, {
              distanceKm: haversineKm(family.approxLocation, other.approxLocation),
            })
          : undefined,
      });
    }

    return delay(views.sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt)));
  }

  async getOutgoingRequests(): Promise<RequestView[]> {
    const { family } = this.requireFamily();
    const s = getState();
    const views: RequestView[] = [];

    for (const request of s.requests.filter(
      (r) => r.fromFamilyId === family.id && (r.status === 'pending' || r.status === 'deferred'),
    )) {
      const projection = this.project(family, request.toFamilyId);
      if (!projection) continue;
      views.push({ request, otherFamily: projection });
    }

    return delay(views.sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt)));
  }

  async getConnections(): Promise<ConversationView[]> {
    const { family } = this.requireFamily();
    const s = getState();
    const views: ConversationView[] = [];

    for (const connection of s.connections.filter(
      (c) => c.familyIds.includes(family.id) && c.state === 'active',
    )) {
      const conversation = s.conversations.find((c) => c.id === connection.conversationId);
      if (!conversation) continue;
      const projection = this.project(family, otherFamilyId(connection.familyIds, family.id));
      if (!projection) continue;
      views.push({ conversation, otherFamily: projection, connection });
    }

    return delay(
      views.sort((a, b) =>
        (b.conversation.lastMessageAt ?? b.conversation.createdAt).localeCompare(
          a.conversation.lastMessageAt ?? a.conversation.createdAt,
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async getConversation(conversationId: string): Promise<ConversationView> {
    const { family } = this.requireFamily();
    const s = getState();
    const conversation = s.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    // Membership check: a conversation id is not a capability.
    if (!conversation.familyIds.includes(family.id)) {
      throw new AuthorizationError('You are not part of this conversation.');
    }
    const connection = s.connections.find((c) => c.id === conversation.connectionId);
    if (!connection) throw new NotFoundError('Connection not found.');
    const projection = this.project(family, otherFamilyId(conversation.familyIds, family.id));
    if (!projection) throw new NotFoundError('That family is no longer available.');

    return delay({ conversation, otherFamily: projection, connection });
  }

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const { session, family, account } = this.requireFamily();
    assertAccountInGoodStanding(account);
    this.limiter.consume(session.accountId, 'message_send');

    const clean = sanitiseText(body, 2000).trim();
    if (!clean) throw new ValidationError('Write a message first.');

    return mutate((s) => {
      const conversation = s.conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new NotFoundError('Conversation not found.');
      if (!conversation.familyIds.includes(family.id)) {
        throw new AuthorizationError('You are not part of this conversation.');
      }
      if (conversation.state !== 'active') {
        throw new ValidationError('This conversation is closed.');
      }
      const other = otherFamilyId(conversation.familyIds, family.id);
      if (isBlockedEitherWay(family.id, other)) {
        throw new AuthorizationError('This conversation is no longer available.');
      }

      // Advisory scan. The flags are attached to the message so a later report carries
      // context, and shown back to the SENDER as a nudge. The recipient is not told,
      // and nothing is blocked — see domain/safety/contentScan.ts for why.
      const safetyFlags = scanMessage(clean);

      const message: Message = {
        id: newId('msg'),
        conversationId,
        senderParentId: session.parentId,
        senderFamilyId: family.id,
        body: clean,
        sentAt: new Date().toISOString(),
        safetyFlags: safetyFlags.length ? safetyFlags : undefined,
      };
      conversation.messages.push(message);
      conversation.lastMessageAt = message.sentAt;

      notify({
        familyId: other,
        kind: 'new_message',
        title: `New message from ${family.displayName}`,
        body: clean.length > 80 ? `${clean.slice(0, 77)}…` : clean,
        href: '/app/messages',
      });

      // Note: the audit entry records that a message was sent, never its content.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'message.sent',
        target: conversationId,
        metadata: { flagged: safetyFlags.length > 0 },
      });

      return delay(message, 80);
    });
  }

  async leaveConversation(conversationId: string): Promise<void> {
    const { session, family } = this.requireFamily();
    mutate((s) => {
      const conversation = s.conversations.find((c) => c.id === conversationId);
      if (!conversation) throw new NotFoundError();
      if (!conversation.familyIds.includes(family.id)) throw new AuthorizationError('Not your conversation.');
      conversation.state = 'left';
      const connection = s.connections.find((c) => c.id === conversation.connectionId);
      if (connection) connection.state = 'left';
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'conversation.left', target: conversationId });
    return delay(undefined);
  }

  async markConversationRead(conversationId: string): Promise<void> {
    const { family } = this.requireFamily();
    mutate((s) => {
      s.readMarkers[`${family.id}:${conversationId}`] = new Date().toISOString();
    });
    return delay(undefined, 20);
  }

  // -----------------------------------------------------------------------
  // PlayDates
  // -----------------------------------------------------------------------

  async proposePlayDate(input: {
    connectionId: string;
    activity: string;
    place: MeetingPlace;
    startsAt: string;
    durationMinutes: number;
    notes?: string;
    attendingChildIds: string[];
    adultPresent: boolean;
  }): Promise<PlayDate> {
    const { session, family, account } = this.requireFamily();
    assertAccountInGoodStanding(account);
    this.limiter.consume(session.accountId, 'playdate_propose');

    return mutate((s) => {
      const connection = s.connections.find((c) => c.id === input.connectionId);
      if (!connection) throw new NotFoundError('Connection not found.');
      if (!connection.familyIds.includes(family.id)) throw new AuthorizationError('Not your connection.');
      if (connection.state !== 'active') throw new ValidationError('This connection is no longer active.');

      const other = otherFamilyId(connection.familyIds, family.id);

      const playdate: PlayDate = {
        id: newId('pd'),
        connectionId: connection.id,
        familyIds: [family.id, other],
        proposedByFamilyId: family.id,
        activity: input.activity,
        place: {
          label: sanitiseText(input.place.label, 120),
          kind: input.place.kind,
          area: sanitiseText(input.place.area, 80),
          isPublic: input.place.isPublic,
        },
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        status: 'proposed',
        notes: input.notes ? sanitiseText(input.notes, 400) : undefined,
        adultPresent: { [family.id]: input.adultPresent },
        attendees: { [family.id]: input.attendingChildIds },
        createdAt: new Date().toISOString(),
      };
      s.playdates.push(playdate);

      notify({
        familyId: other,
        kind: 'playdate_proposed',
        title: `${family.displayName} proposed a playdate`,
        body: `${input.place.label} · ${new Date(input.startsAt).toLocaleString('en-GB', {
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        href: '/app/playdates',
      });

      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'playdate.proposed',
        target: playdate.id,
        metadata: { publicPlace: input.place.isPublic },
      });

      return delay(playdate);
    });
  }

  async respondToPlayDate(
    playdateId: string,
    response: 'confirmed' | 'declined',
    opts: { attendingChildIds?: string[]; adultPresent?: boolean } = {},
  ): Promise<PlayDate> {
    const { session, family } = this.requireFamily();
    return mutate((s) => {
      const playdate = s.playdates.find((p) => p.id === playdateId);
      if (!playdate) throw new NotFoundError('Playdate not found.');
      if (!playdate.familyIds.includes(family.id)) throw new AuthorizationError('Not your playdate.');
      if (playdate.proposedByFamilyId === family.id) {
        throw new ValidationError('The other family needs to respond to this one.');
      }

      playdate.status = response;
      if (opts.attendingChildIds) playdate.attendees[family.id] = opts.attendingChildIds;
      if (opts.adultPresent !== undefined) playdate.adultPresent[family.id] = opts.adultPresent;

      const other = otherFamilyId(playdate.familyIds, family.id);
      notify({
        familyId: other,
        kind: response === 'confirmed' ? 'playdate_confirmed' : 'playdate_proposed',
        title:
          response === 'confirmed'
            ? `Playdate confirmed with ${family.displayName}`
            : `${family.displayName} can't make that time`,
        body:
          response === 'confirmed'
            ? `${playdate.place.label} · ${new Date(playdate.startsAt).toLocaleString('en-GB', {
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'You can suggest another time.',
        href: '/app/playdates',
      });

      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: `playdate.${response}`,
        target: playdateId,
      });
      return delay(playdate);
    });
  }

  async cancelPlayDate(playdateId: string, reason?: string): Promise<PlayDate> {
    const { session, family } = this.requireFamily();
    return mutate((s) => {
      const playdate = s.playdates.find((p) => p.id === playdateId);
      if (!playdate) throw new NotFoundError();
      if (!playdate.familyIds.includes(family.id)) throw new AuthorizationError('Not your playdate.');
      playdate.status = 'cancelled';
      const other = otherFamilyId(playdate.familyIds, family.id);
      notify({
        familyId: other,
        kind: 'playdate_proposed',
        title: `${family.displayName} cancelled the playdate`,
        body: reason ? sanitiseText(reason, 200) : 'No reason given.',
        href: '/app/playdates',
      });
      audit({ actor: session.accountId, actorRole: session.role, action: 'playdate.cancelled', target: playdateId });
      return delay(playdate);
    });
  }

  async sharePlanWithTrustedAdult(playdateId: string, name: string): Promise<PlayDate> {
    const { session, family } = this.requireFamily();
    return mutate((s) => {
      const playdate = s.playdates.find((p) => p.id === playdateId);
      if (!playdate) throw new NotFoundError();
      if (!playdate.familyIds.includes(family.id)) throw new AuthorizationError('Not your playdate.');
      playdate.sharedWith = [
        ...(playdate.sharedWith ?? []),
        { name: sanitiseText(name, 80), sharedAt: new Date().toISOString() },
      ];
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'playdate.shared_with_trusted_adult',
        target: playdateId,
      });
      return delay(playdate);
    });
  }

  async submitPostMeetingFeedback(
    playdateId: string,
    feedback: Omit<PostMeetingFeedback, 'submittedAt'>,
  ): Promise<PlayDate> {
    const { session, family } = this.requireFamily();
    return mutate((s) => {
      const playdate = s.playdates.find((p) => p.id === playdateId);
      if (!playdate) throw new NotFoundError();
      if (!playdate.familyIds.includes(family.id)) throw new AuthorizationError('Not your playdate.');

      playdate.postMeetingFeedback = {
        ...(playdate.postMeetingFeedback ?? {}),
        // Feedback is private to the family who wrote it. The other family is never
        // shown it, and it never appears on anyone's profile.
        [family.id]: {
          ...feedback,
          concerns: feedback.concerns ? sanitiseText(feedback.concerns, 600) : undefined,
          submittedAt: new Date().toISOString(),
        },
      };
      if (playdate.status === 'confirmed') playdate.status = 'completed';
      this.refreshTrustSignals(session.parentId);

      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'playdate.feedback_submitted',
        target: playdateId,
        metadata: { hasConcerns: Boolean(feedback.concerns) },
      });
      return delay(playdate);
    });
  }

  async getPlayDates(): Promise<PlayDateView[]> {
    const { family } = this.requireFamily();
    const views: PlayDateView[] = [];
    for (const playdate of getState().playdates.filter((p) => p.familyIds.includes(family.id))) {
      const projection = this.project(family, otherFamilyId(playdate.familyIds, family.id));
      if (!projection) continue;
      views.push({ playdate, otherFamily: projection });
    }
    return delay(views.sort((a, b) => a.playdate.startsAt.localeCompare(b.playdate.startsAt)));
  }

  // -----------------------------------------------------------------------
  // Safety
  // -----------------------------------------------------------------------

  async reportFamily(input: {
    reportedFamilyId: string;
    reason: ReportReason;
    details: string;
    evidenceMessageIds?: string[];
    alsoBlock?: boolean;
  }): Promise<Report> {
    const { session, family } = this.requireFamily();
    this.limiter.consume(session.accountId, 'report_submit');

    const details = sanitiseText(input.details, 2000).trim();
    if (details.length < 10) {
      throw new ValidationError('Please add a little detail so our team can review this properly.', 'details');
    }

    return mutate((s) => {
      // Reports are grouped into ONE case per reported family, so a pattern across
      // several reporters is visible to a moderator as a pattern rather than as
      // unrelated tickets.
      let moderationCase = s.cases.find(
        (c) => c.reportedFamilyId === input.reportedFamilyId && c.status !== 'dismissed' && c.status !== 'actioned',
      );

      const urgent = input.reason === 'child_safety_urgent';

      if (!moderationCase) {
        moderationCase = {
          id: newId('case'),
          reportedFamilyId: input.reportedFamilyId,
          reportIds: [],
          status: 'open',
          priority: urgent ? 'urgent' : 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: [],
          actions: [],
        };
        s.cases.push(moderationCase);
      } else if (urgent) {
        moderationCase.priority = 'urgent';
      } else if (moderationCase.reportIds.length >= 2 && moderationCase.priority === 'normal') {
        // Report threshold: a third independent report raises priority automatically.
        // It does NOT change the reported family's account state — only a human does.
        moderationCase.priority = 'high';
      }

      const report: Report = {
        id: newId('rep'),
        reporterFamilyId: family.id,
        reportedFamilyId: input.reportedFamilyId,
        reason: input.reason,
        details,
        evidenceMessageIds: input.evidenceMessageIds,
        createdAt: new Date().toISOString(),
        caseId: moderationCase.id,
      };
      s.reports.push(report);
      moderationCase.reportIds.push(report.id);
      moderationCase.updatedAt = report.createdAt;

      if (input.alsoBlock) {
        s.blocks.push({
          blockerFamilyId: family.id,
          blockedFamilyId: input.reportedFamilyId,
          createdAt: new Date().toISOString(),
          reason: 'Blocked when reporting',
        });
      }

      // The reported family is NOT notified. Telling someone they have been reported
      // invites retaliation against the reporter and destroys evidence.
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'report.submitted',
        target: input.reportedFamilyId,
        caseId: moderationCase.id,
        metadata: { reason: input.reason, urgent },
      });

      return delay(report);
    });
  }

  async blockFamily(familyId: string, reason?: string): Promise<void> {
    const { session, family } = this.requireFamily();
    mutate((s) => {
      if (isBlockedEitherWay(family.id, familyId)) return;
      s.blocks.push({
        blockerFamilyId: family.id,
        blockedFamilyId: familyId,
        createdAt: new Date().toISOString(),
        reason: reason ? sanitiseText(reason, 200) : undefined,
      });
      // Blocking closes any live conversation immediately — it must take effect now,
      // not after a review.
      for (const c of s.conversations) {
        if (c.familyIds.includes(family.id) && c.familyIds.includes(familyId)) c.state = 'closed';
      }
      for (const c of s.connections) {
        if (c.familyIds.includes(family.id) && c.familyIds.includes(familyId)) c.state = 'blocked';
      }
      // Any pending request between the two is withdrawn.
      for (const r of s.requests) {
        if (
          r.status === 'pending' &&
          r.fromFamilyId !== undefined &&
          ((r.fromFamilyId === family.id && r.toFamilyId === familyId) ||
            (r.fromFamilyId === familyId && r.toFamilyId === family.id))
        ) {
          r.status = 'withdrawn';
        }
      }
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'family.blocked', target: familyId });
    return delay(undefined);
  }

  async unblockFamily(familyId: string): Promise<void> {
    const { session, family } = this.requireFamily();
    mutate((s) => {
      s.blocks = s.blocks.filter(
        (b) => !(b.blockerFamilyId === family.id && b.blockedFamilyId === familyId),
      );
    });
    audit({ actor: session.accountId, actorRole: session.role, action: 'family.unblocked', target: familyId });
    return delay(undefined);
  }

  async getBlockedFamilies(): Promise<Array<{ familyId: string; displayName: string; createdAt: string }>> {
    const { family } = this.requireFamily();
    return delay(
      getState()
        .blocks.filter((b) => b.blockerFamilyId === family.id)
        .map((b) => ({
          familyId: b.blockedFamilyId,
          displayName: findFamily(b.blockedFamilyId)?.displayName ?? 'Unknown family',
          createdAt: b.createdAt,
        })),
    );
  }

  async getMyReports(): Promise<Report[]> {
    const { family } = this.requireFamily();
    return delay(getState().reports.filter((r) => r.reporterFamilyId === family.id));
  }

  // -----------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------

  async getNotifications(): Promise<AppNotification[]> {
    const { family } = this.requireFamily();
    return delay(getState().notifications.filter((n) => n.familyId === family.id), 40);
  }

  async markNotificationRead(id: string): Promise<void> {
    const { family } = this.requireFamily();
    mutate((s) => {
      const n = s.notifications.find((x) => x.id === id && x.familyId === family.id);
      if (n) n.read = true;
    });
    return delay(undefined, 20);
  }

  async markAllNotificationsRead(): Promise<void> {
    const { family } = this.requireFamily();
    mutate((s) => {
      for (const n of s.notifications) if (n.familyId === family.id) n.read = true;
    });
    return delay(undefined, 20);
  }

  // -----------------------------------------------------------------------
  // Admin
  // -----------------------------------------------------------------------

  async adminOverview(): Promise<AdminOverview> {
    const session = this.requireSession();
    // The prototype lets a parent open the admin views so the concept is demonstrable;
    // it audits every such view explicitly. A real deployment has no such path — staff
    // tooling lives behind separate accounts, separate auth, and ideally a separate app.
    const isStaff = session.role !== 'parent';
    if (!isStaff) {
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'admin.viewed_as_prototype_demo',
        metadata: { note: 'Prototype affordance — not a production access path' },
      });
    }

    const s = getState();
    return delay({
      pendingVerifications: s.parentIdentities
        .filter((p) => p.verificationStatus === 'pending' || p.verificationStatus === 'required')
        .map((p) => {
          const membership = s.memberships.find((m) => m.parentId === p.parentId);
          const family = membership ? findFamily(membership.familyId) : undefined;
          return {
            parentId: p.parentId,
            familyDisplayName: family?.displayName ?? 'Unknown family',
            submittedAt: p.verificationUpdatedAt ?? '',
            status: p.verificationStatus,
          };
        }),
      openCases: s.cases.filter((c) => c.status === 'open' || c.status === 'investigating'),
      accounts: s.memberships.map((m) => {
        const profile = findParentProfile(m.parentId);
        const account = s.accounts.find((a) => a.id === profile?.accountId);
        const family = findFamily(m.familyId);
        return {
          accountId: account?.id ?? '',
          familyId: m.familyId,
          familyDisplayName: family?.displayName ?? '',
          state: account?.state ?? 'active',
          verification: family?.verificationStatus ?? 'unstarted',
          joinedAt: m.joinedAt,
        };
      }),
      auditLog: s.auditLog.slice(0, 100),
    });
  }

  async adminDecideVerification(
    parentId: string,
    outcome: 'verified' | 'failed',
    rationale: string,
  ): Promise<void> {
    const session = this.requireSession();
    mutate((s) => {
      const identity = s.parentIdentities.find((p) => p.parentId === parentId);
      if (!identity) throw new NotFoundError();
      identity.verificationStatus = outcome;
      identity.verificationUpdatedAt = new Date().toISOString();
      if (outcome === 'failed') identity.verificationFailureReason = sanitiseText(rationale, 300);

      const profile = findParentProfile(parentId);
      const account = s.accounts.find((a) => a.id === profile?.accountId);
      if (account) account.state = outcome === 'verified' ? 'active' : 'verification_required';

      const membership = s.memberships.find((m) => m.parentId === parentId);
      if (membership) {
        const family = findFamily(membership.familyId);
        if (family) {
          family.verificationStatus = outcome;
          family.accountState = account?.state ?? family.accountState;
        }
        notify({
          familyId: membership.familyId,
          kind: 'verification_update',
          title: outcome === 'verified' ? 'Identity verification complete' : 'Verification could not be completed',
          body:
            outcome === 'verified'
              ? 'You can now browse families and send connection requests.'
              : 'You can try again from the Verification page.',
          href: '/app/verification',
        });
      }
    });

    audit({
      actor: session.accountId,
      actorRole: session.role,
      action: 'admin.verification_decided',
      target: parentId,
      metadata: { outcome },
    });
    return delay(undefined);
  }

  async adminActOnCase(
    caseId: string,
    action: ModerationActionKind,
    rationale: string,
  ): Promise<ModerationCase> {
    const session = this.requireSession();
    const clean = sanitiseText(rationale, 1000).trim();
    if (!clean) throw new ValidationError('A rationale is required for every moderation action.');

    return mutate((s) => {
      const moderationCase = s.cases.find((c) => c.id === caseId);
      if (!moderationCase) throw new NotFoundError('Case not found.');

      moderationCase.actions.push({
        kind: action,
        at: new Date().toISOString(),
        by: session.accountId,
        rationale: clean,
      });
      moderationCase.status = action === 'dismiss' || action === 'no_action' ? 'dismissed' : 'actioned';
      moderationCase.updatedAt = new Date().toISOString();

      // Only a moderator decision changes an account state. Reports alone never do.
      const family = findFamily(moderationCase.reportedFamilyId);
      const membership = s.memberships.find((m) => m.familyId === moderationCase.reportedFamilyId);
      const profile = membership ? findParentProfile(membership.parentId) : undefined;
      const account = s.accounts.find((a) => a.id === profile?.accountId);

      if (account && family) {
        switch (action) {
          case 'require_reverification':
            account.state = 'verification_required';
            break;
          case 'restrict_account':
            account.state = 'restricted';
            break;
          case 'suspend_account':
            account.state = 'suspended';
            break;
          case 'ban_account':
            account.state = 'banned';
            break;
          case 'warning_issued':
          case 'no_action':
          case 'dismiss':
            account.state = 'active';
            break;
        }
        family.accountState = account.state;
      }

      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'moderation.action_taken',
        target: moderationCase.reportedFamilyId,
        caseId,
        metadata: { actionKind: action },
      });

      return delay(moderationCase);
    });
  }

  async adminAddCaseNote(caseId: string, body: string): Promise<ModerationCase> {
    const session = this.requireSession();
    return mutate((s) => {
      const moderationCase = s.cases.find((c) => c.id === caseId);
      if (!moderationCase) throw new NotFoundError();
      moderationCase.notes.push({
        at: new Date().toISOString(),
        by: session.accountId,
        body: sanitiseText(body, 1000),
      });
      moderationCase.status = 'investigating';
      moderationCase.updatedAt = new Date().toISOString();
      audit({
        actor: session.accountId,
        actorRole: session.role,
        action: 'moderation.note_added',
        caseId,
      });
      return delay(moderationCase);
    });
  }

  // -----------------------------------------------------------------------
  // Prototype utilities
  // -----------------------------------------------------------------------

  async resetPrototype(): Promise<void> {
    resetState();
    this.limiter.reset();
    this.session = null;
    saveSession(null);
    return delay(undefined, 200);
  }
}

// ---------------------------------------------------------------------------
// Dashboard "what can I do now?"
// ---------------------------------------------------------------------------

/**
 * The dashboard's job is to answer one question: what can I do now?
 *
 * Steps are ordered by what actually unblocks the parent, so an unverified family is
 * told to verify rather than shown an empty discovery feed they cannot use.
 */
function buildNextSteps(input: {
  family: Family;
  account: Account;
  incoming: number;
  matchCount: number;
  upcoming: PlayDate[];
}): NextStep[] {
  const steps: NextStep[] = [];
  const { family, account, incoming, matchCount } = input;

  if (!account.emailVerified || !account.phoneVerified) {
    steps.push({
      id: 'verify-contact',
      titleKey: 'step.verifyContact.title',
      descKey: 'step.verifyContact.desc',
      ctaKey: 'step.verifyContact.cta',
      href: '/app/verification',
      tone: 'action',
    });
  }

  if (family.verificationStatus !== 'verified') {
    steps.push({
      id: 'verify-identity',
      titleKey: 'step.verifyId.title',
      descKey: 'step.verifyId.desc',
      ctaKey: 'step.verifyId.cta',
      href: '/app/verification',
      tone: 'action',
    });
  }

  if (family.children.length === 0) {
    steps.push({
      id: 'add-child',
      titleKey: 'step.addChild.title',
      descKey: 'step.addChild.desc',
      ctaKey: 'step.addChild.cta',
      href: '/app/children',
      tone: 'action',
    });
  } else if (family.children.some((c) => c.interests.length < 3)) {
    steps.push({
      id: 'add-interests',
      titleKey: 'step.addInterests.title',
      descKey: 'step.addInterests.desc',
      ctaKey: 'step.addInterests.cta',
      href: '/app/children',
      tone: 'info',
    });
  }

  if (family.availability.length === 0) {
    steps.push({
      id: 'set-availability',
      titleKey: 'step.availability.title',
      descKey: 'step.availability.desc',
      ctaKey: 'step.availability.cta',
      href: '/app/settings',
      tone: 'action',
    });
  }

  if (incoming > 0) {
    steps.push({
      id: 'respond-requests',
      titleKey: incoming === 1 ? 'step.requestsOne.title' : 'step.requests.title',
      titleVars: { n: incoming },
      descKey: 'step.requests.desc',
      ctaKey: 'step.requests.cta',
      href: '/app/requests',
      tone: 'action',
    });
  }

  if (!account.safetyGuidelinesAcceptedAt) {
    steps.push({
      id: 'safety',
      titleKey: 'step.safety.title',
      descKey: 'step.safety.desc',
      ctaKey: 'step.safety.cta',
      href: '/app/safety',
      tone: 'safety',
    });
  }

  if (steps.length === 0 && matchCount > 0) {
    steps.push({
      id: 'discover',
      titleKey: 'step.discover.title',
      titleVars: { n: matchCount },
      descKey: 'step.discover.desc',
      ctaKey: 'step.discover.cta',
      href: '/app/discover',
      tone: 'action',
    });
  }

  return steps.slice(0, 4);
}

export { RateLimitError, AuthorizationError };
