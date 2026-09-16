import type {
  Account,
  AppNotification,
  AuditLogEntry,
  Block,
  Connection,
  ConnectionRequest,
  Conversation,
  DeviceSession,
  Family,
  FamilyMembership,
  ModerationCase,
  ParentIdentity,
  ParentProfile,
  PlayDate,
  Report,
  Role,
  Session,
} from '../../domain/types';
import { buildSeed } from '../../data/seed';
import { redactForLog } from '../../domain/privacy/redaction';

/**
 * In-memory store with localStorage persistence.
 *
 * This stands in for a database. It is deliberately shaped like one — normalised
 * collections, explicit ids, no nesting of one aggregate inside another — so replacing
 * it with real tables is a mechanical translation rather than a redesign.
 *
 * Nothing here is a security boundary. localStorage is readable by anything running on
 * the origin. That is acceptable for a prototype holding fictional data, and is called
 * out in PROTOTYPE_DISCLOSURES.md; it is never acceptable for real family data.
 */

const STORAGE_KEY = 'playdate.prototype.v1';
const SESSION_KEY = 'playdate.session.v1';

/** 30 minutes of inactivity. Real systems also rotate on privilege change. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface StoreState {
  accounts: Account[];
  parentProfiles: ParentProfile[];
  parentIdentities: ParentIdentity[];
  memberships: FamilyMembership[];
  families: Family[];
  requests: ConnectionRequest[];
  connections: Connection[];
  conversations: Conversation[];
  playdates: PlayDate[];
  reports: Report[];
  cases: ModerationCase[];
  blocks: Block[];
  notifications: AppNotification[];
  auditLog: AuditLogEntry[];
  deviceSessions: DeviceSession[];
  /** Per-viewer photo consent grants: `${viewerFamilyId}->${targetFamilyId}`. */
  photoConsents: string[];
  /** Conversation read markers: `${familyId}:${conversationId}` -> ISO timestamp. */
  readMarkers: Record<string, string>;
  /** Simulated verification codes, so the prototype can be driven end to end. */
  pendingCodes: Record<string, string>;
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${idCounter.toString(36)}`;
}

function seedState(): StoreState {
  const seed = buildSeed();
  const state: StoreState = {
    accounts: seed.accounts,
    parentProfiles: seed.parentProfiles,
    parentIdentities: seed.parentIdentities,
    memberships: seed.memberships,
    families: seed.families,
    requests: [],
    connections: [],
    conversations: [],
    playdates: [],
    reports: [],
    cases: [],
    blocks: [],
    notifications: [],
    auditLog: [],
    deviceSessions: [
      {
        id: 'dev_current',
        label: 'This browser',
        lastSeenAt: new Date().toISOString(),
        current: true,
        location: 'Jerusalem, IL',
      },
      {
        id: 'dev_phone',
        label: 'iPhone — PlayDate app',
        lastSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
        current: false,
        location: 'Jerusalem, IL',
      },
    ],
    photoConsents: [],
    readMarkers: {},
    pendingCodes: {},
  };

  seedDemoActivity(state);
  return state;
}

/**
 * Pre-populate the demo family with a realistic mid-use state: one incoming request,
 * one outgoing, two live conversations, a confirmed playdate and a moderation case.
 * Without this the prototype opens on empty screens and demonstrates nothing.
 */
function seedDemoActivity(state: StoreState): void {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  const COHEN = 'fam_cohen';

  // --- An accepted connection with the Levi family, mid-conversation -------
  const leviConvId = 'con_levi_conv';
  const leviConnId = 'conn_levi';
  state.connections.push({
    id: leviConnId,
    familyIds: [COHEN, 'fam_levi'],
    createdAt: at(72),
    conversationId: leviConvId,
    state: 'active',
  });
  state.conversations.push({
    id: leviConvId,
    connectionId: leviConnId,
    familyIds: [COHEN, 'fam_levi'],
    createdAt: at(72),
    lastMessageAt: at(18),
    state: 'active',
    messages: [
      {
        id: newId('msg'),
        conversationId: leviConvId,
        senderParentId: 'par_cohen',
        senderFamilyId: COHEN,
        body: "Hi Tamar! Lovely to connect. Noa and Yael both seem to be LEGO obsessives — that feels promising.",
        sentAt: at(70),
      },
      {
        id: newId('msg'),
        conversationId: leviConvId,
        senderParentId: 'par_levi',
        senderFamilyId: 'fam_levi',
        body: "Hi Maya! It really does. Yael has just finished a huge set and is looking for someone to start the next one with.",
        sentAt: at(66),
      },
      {
        id: newId('msg'),
        conversationId: leviConvId,
        senderParentId: 'par_levi',
        senderFamilyId: 'fam_levi',
        body: 'Would a playground meet-up on Saturday afternoon suit you? We usually go to Gan Sacher.',
        sentAt: at(65),
      },
      {
        id: newId('msg'),
        conversationId: leviConvId,
        senderParentId: 'par_cohen',
        senderFamilyId: COHEN,
        body: "That works for us. Saturday afternoons are our easiest slot. Shall we say 3pm?",
        sentAt: at(18),
      },
    ],
  });
  state.requests.push({
    id: 'req_levi',
    fromFamilyId: COHEN,
    toFamilyId: 'fam_levi',
    status: 'accepted',
    createdAt: at(80),
    respondedAt: at(72),
    note: 'Our girls seem to share a lot of interests — would you like to connect?',
  });

  // --- A confirmed playdate with the Levi family --------------------------
  const saturday = new Date(now);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));
  saturday.setHours(15, 0, 0, 0);
  state.playdates.push({
    id: 'pd_levi',
    connectionId: leviConnId,
    familyIds: [COHEN, 'fam_levi'],
    proposedByFamilyId: 'fam_levi',
    activity: 'playground',
    place: {
      label: 'Gan Sacher — main playground',
      kind: 'playground',
      area: 'Nachlaot',
      isPublic: true,
    },
    startsAt: saturday.toISOString(),
    durationMinutes: 90,
    status: 'confirmed',
    notes: 'By the big climbing frame. We usually bring a ball.',
    adultPresent: { [COHEN]: true, fam_levi: true },
    attendees: { [COHEN]: ['chi_cohen_0'], fam_levi: ['chi_levi_0'] },
    createdAt: at(40),
  });

  // --- A second connection with the Peretz family, quieter ----------------
  const peretzConvId = 'con_peretz_conv';
  const peretzConnId = 'conn_peretz';
  state.connections.push({
    id: peretzConnId,
    familyIds: [COHEN, 'fam_peretz'],
    createdAt: at(30),
    conversationId: peretzConvId,
    state: 'active',
  });
  state.conversations.push({
    id: peretzConvId,
    connectionId: peretzConnId,
    familyIds: [COHEN, 'fam_peretz'],
    createdAt: at(30),
    lastMessageAt: at(26),
    state: 'active',
    messages: [
      {
        id: newId('msg'),
        conversationId: peretzConvId,
        senderParentId: 'par_peretz',
        senderFamilyId: 'fam_peretz',
        body: "Hi! Thanks for accepting. Eitan and Dani are both deep in a dinosaur phase — I suspect they'd get on.",
        sentAt: at(28),
      },
      {
        id: newId('msg'),
        conversationId: peretzConvId,
        senderParentId: 'par_peretz',
        senderFamilyId: 'fam_peretz',
        body: 'We are free most weekday afternoons if that ever suits you.',
        sentAt: at(26),
      },
    ],
  });
  state.requests.push({
    id: 'req_peretz',
    fromFamilyId: 'fam_peretz',
    toFamilyId: COHEN,
    status: 'accepted',
    createdAt: at(34),
    respondedAt: at(30),
  });

  // --- Two pending incoming requests --------------------------------------
  state.requests.push({
    id: 'req_katz_in',
    fromFamilyId: 'fam_katz',
    toFamilyId: COHEN,
    status: 'pending',
    createdAt: at(20),
    note: "Hello! Tali is a bit shy but loves drawing and board games — your Noa sounds like a lovely match. Would you like to connect?",
    matchSummary: 'Both children are 8 · 3 shared interests · Saturday afternoons overlap',
  });
  state.requests.push({
    id: 'req_shapiro_in',
    fromFamilyId: 'fam_shapiro',
    toFamilyId: COHEN,
    status: 'pending',
    createdAt: at(5),
    note: "Hi — we're new to Jerusalem and Ari is desperate to find someone who takes LEGO as seriously as he does.",
    matchSummary: 'LEGO is important to both families · 3 shared interests · about 3 km apart',
  });

  // --- One outgoing pending request ---------------------------------------
  state.requests.push({
    id: 'req_hadad_out',
    fromFamilyId: COHEN,
    toFamilyId: 'fam_hadad',
    status: 'pending',
    createdAt: at(12),
    note: 'Our Dani is very into dinosaurs too — would you like to connect?',
  });

  // --- Notifications -------------------------------------------------------
  state.notifications.push(
    {
      id: newId('ntf'),
      familyId: COHEN,
      kind: 'connection_request',
      titleKey: 'ntf.connectionRequest.title',
      titleVars: { name: 'The Shapiro Family' },
      bodyKey: 'ntf.connectionRequest.body',
      createdAt: at(5),
      read: false,
      href: '/app/requests',
    },
    {
      id: newId('ntf'),
      familyId: COHEN,
      kind: 'new_message',
      titleKey: 'ntf.newMessage.title',
      titleVars: { name: 'The Levi Family' },
      bodyKey: 'ntf.newMessage.body',
      bodyVars: { preview: 'Would a playground meet-up on Saturday afternoon suit you?' },
      createdAt: at(18),
      read: false,
      href: '/app/messages',
    },
    {
      id: newId('ntf'),
      familyId: COHEN,
      kind: 'playdate_confirmed',
      titleKey: 'ntf.playdateConfirmed.title',
      titleVars: { name: 'The Levi Family' },
      bodyKey: 'ntf.playdateProposed.body',
      bodyVars: { place: 'Gan Sacher — main playground' },
      createdAt: at(40),
      read: true,
      href: '/app/playdates',
    },
    {
      id: newId('ntf'),
      familyId: COHEN,
      kind: 'connection_request',
      titleKey: 'ntf.connectionRequest.title',
      titleVars: { name: 'The Katz Family' },
      bodyKey: 'ntf.connectionRequest.body',
      createdAt: at(20),
      read: false,
      href: '/app/requests',
    },
  );

  // --- A moderation case, so the admin view has something real in it -------
  const caseId = 'case_demo_1';
  const reportId = 'rep_demo_1';
  state.reports.push({
    id: reportId,
    reporterFamilyId: 'fam_amar',
    reportedFamilyId: 'fam_barak',
    reason: 'misrepresentation',
    details:
      'The profile says one child aged 7 but the parent referred to "my teenagers" in conversation. Might be nothing, but it did not add up.',
    createdAt: at(50),
    caseId,
  });
  state.cases.push({
    id: caseId,
    reportedFamilyId: 'fam_barak',
    reportIds: [reportId],
    status: 'open',
    priority: 'normal',
    createdAt: at(50),
    updatedAt: at(50),
    notes: [
      {
        at: at(48),
        by: 'moderator@playdate',
        body: 'Account is new and identity verification has not completed. Holding discovery access until it does.',
      },
    ],
    actions: [],
  });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

let state: StoreState | null = null;

export function getState(): StoreState {
  if (state) return state;

  if (canUseStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw) as StoreState;
        return state;
      }
    } catch {
      // Corrupt or unreadable storage — fall through to a fresh seed rather than
      // leaving the app in a broken state.
    }
  }

  state = seedState();
  persist();
  return state;
}

export function persist(): void {
  if (!state || !canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled. The app keeps working in memory.
  }
}

export function resetState(): void {
  state = seedState();
  if (canUseStorage()) {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  persist();
}

export function mutate<T>(fn: (s: StoreState) => T): T {
  const result = fn(getState());
  persist();
  return result;
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

/**
 * Prototype session storage.
 *
 * Production uses an HttpOnly, Secure, SameSite=Lax cookie that JavaScript cannot read,
 * so an XSS bug cannot exfiltrate the session. localStorage is used here only because a
 * static prototype has no server to set a cookie — this is the single largest gap
 * between this code and something deployable, and it is listed as such in
 * PROTOTYPE_DISCLOSURES.md.
 */
export function loadSession(): Session | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (!canUseStorage()) return;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Extend an active session's idle window. Called on each authorised action. */
export function touchSession(session: Session): Session {
  const next = { ...session, expiresAt: Date.now() + SESSION_IDLE_MS };
  saveSession(next);
  return next;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Append-only audit entry.
 *
 * Every payload passes through `redactForLog` first: the audit trail records what
 * happened without becoming a second, less protected copy of the family database.
 */
export function audit(entry: {
  actor: string;
  actorRole: Role | 'system';
  action: string;
  target?: string;
  caseId?: string;
  metadata?: Record<string, unknown>;
}): void {
  const s = getState();
  s.auditLog.unshift({
    id: newId('aud'),
    at: new Date().toISOString(),
    actor: entry.actor,
    actorRole: entry.actorRole,
    action: entry.action,
    target: entry.target,
    caseId: entry.caseId,
    metadata: entry.metadata
      ? (redactForLog(entry.metadata) as Record<string, string | number | boolean>)
      : undefined,
  });
  // Bound the prototype's log. A real append-only store has its own retention policy.
  if (s.auditLog.length > 500) s.auditLog.length = 500;
  persist();
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findAccount(id: string): Account | undefined {
  return getState().accounts.find((a) => a.id === id);
}

export function findFamily(id: string): Family | undefined {
  return getState().families.find((f) => f.id === id);
}

export function findParentProfile(id: string): ParentProfile | undefined {
  return getState().parentProfiles.find((p) => p.id === id);
}

export function findIdentity(parentId: string): ParentIdentity | undefined {
  return getState().parentIdentities.find((p) => p.parentId === parentId);
}

export function primaryParentOfFamily(familyId: string): ParentProfile | undefined {
  const s = getState();
  const membership = s.memberships.find((m) => m.familyId === familyId && m.role === 'primary');
  return membership ? s.parentProfiles.find((p) => p.id === membership.parentId) : undefined;
}

export function isBlockedEitherWay(a: string, b: string): boolean {
  return getState().blocks.some(
    (x) =>
      (x.blockerFamilyId === a && x.blockedFamilyId === b) ||
      (x.blockerFamilyId === b && x.blockedFamilyId === a),
  );
}

export function connectionBetween(a: string, b: string): Connection | undefined {
  return getState().connections.find(
    (c) =>
      c.state === 'active' &&
      ((c.familyIds[0] === a && c.familyIds[1] === b) ||
        (c.familyIds[0] === b && c.familyIds[1] === a)),
  );
}

export function confirmedPlaydateBetween(a: string, b: string): PlayDate | undefined {
  return getState().playdates.find(
    (p) =>
      (p.status === 'confirmed' || p.status === 'completed') &&
      p.familyIds.includes(a) &&
      p.familyIds.includes(b),
  );
}

export function otherFamilyId(pair: readonly [string, string], mine: string): string {
  return pair[0] === mine ? pair[1] : pair[0];
}

export function notify(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  getState().notifications.unshift({
    ...n,
    id: newId('ntf'),
    createdAt: new Date().toISOString(),
    read: false,
  });
  persist();
}
