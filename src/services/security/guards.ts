import { DisclosureTier } from '../../domain/types';
import type { Account, Family, Role, Session } from '../../domain/types';

/**
 * Authorization guards.
 *
 * Every guard here is enforced in the SERVICE layer, not in routing. Route guards are a
 * UX nicety — they stop a parent seeing a page that would confuse them. These stop an
 * action. In production the identical checks run server-side, because anything on the
 * client is advisory by definition.
 */

export class AuthorizationError extends Error {
  readonly code: string;
  constructor(message: string, code = 'forbidden') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

export function assertSession(session: Session | null): asserts session is Session {
  if (!session) throw new AuthorizationError('You need to be signed in.', 'unauthenticated');
  if (Date.now() > session.expiresAt) {
    throw new AuthorizationError('Your session has expired. Please sign in again.', 'session_expired');
  }
}

export function assertRole(session: Session, ...roles: Role[]): void {
  if (!roles.includes(session.role)) {
    throw new AuthorizationError('You do not have access to this area.', 'wrong_role');
  }
}

export function assertOwnFamily(session: Session, familyId: string): void {
  if (session.familyId !== familyId) {
    throw new AuthorizationError('You can only change your own family.', 'not_your_family');
  }
}

/**
 * The gate that matters most.
 *
 * An unverified adult must never be able to browse detailed information about other
 * people's children. Verification is therefore a precondition for discovery, for sending
 * requests, and for messaging — not just a badge.
 */
export function assertCanDiscover(account: Account, family: Family | null): void {
  if (!family) {
    throw new AuthorizationError('Create your family profile first.', 'no_family');
  }
  if (!account.emailVerified) {
    throw new AuthorizationError('Verify your email address to continue.', 'email_unverified');
  }
  if (!account.phoneVerified) {
    throw new AuthorizationError('Verify your phone number to continue.', 'phone_unverified');
  }
  if (family.verificationStatus !== 'verified') {
    throw new AuthorizationError(
      'Identity verification is required before you can browse families. This is how we keep PlayDate to verified parents only.',
      'identity_unverified',
    );
  }
  assertAccountInGoodStanding(account);
}

export function assertAccountInGoodStanding(account: Account): void {
  switch (account.state) {
    case 'active':
      return;
    case 'verification_required':
      throw new AuthorizationError('Please complete verification to continue.', 'verification_required');
    case 'under_review':
      throw new AuthorizationError(
        'Your account is being reviewed. You can still access your family profile and existing conversations.',
        'under_review',
      );
    case 'restricted':
      throw new AuthorizationError(
        'Your account is temporarily restricted. You cannot send new requests while this is in place.',
        'restricted',
      );
    case 'suspended':
      throw new AuthorizationError('Your account is suspended.', 'suspended');
    case 'banned':
      throw new AuthorizationError('This account has been permanently closed.', 'banned');
    default:
      throw new AuthorizationError('Your account cannot perform this action.', 'forbidden');
  }
}

/**
 * Decide how much of `target` the viewer may see.
 *
 * This is the function that turns consent into disclosure. It is the only input to
 * `projectFamily` that can raise a tier, and it never raises one on its own — a tier
 * above DISCOVERY requires a record of the other family having said yes.
 */
export function resolveDisclosureTier(input: {
  viewerFamilyId: string | null;
  targetFamilyId: string;
  hasConnection: boolean;
  hasConfirmedPlaydate: boolean;
  canDiscover: boolean;
  isBlockedEitherWay: boolean;
}): DisclosureTier {
  if (input.viewerFamilyId === input.targetFamilyId) return DisclosureTier.SELF;
  if (input.isBlockedEitherWay) return DisclosureTier.NONE;
  if (input.hasConfirmedPlaydate) return DisclosureTier.PLANNING;
  if (input.hasConnection) return DisclosureTier.CONNECTED;
  if (input.canDiscover) return DisclosureTier.DISCOVERY;
  return DisclosureTier.NONE;
}

/**
 * Moderator reads of another family's data are deliberately awkward: they require an
 * open case id, and they are audit-logged with that id. "Because I could" is not a
 * reason, and an operator who reads a family's conversation without a case leaves a
 * trace that says so.
 */
export function assertModeratorAccess(session: Session, caseId: string | undefined): void {
  assertRole(session, 'moderator', 'admin');
  if (!caseId) {
    throw new AuthorizationError(
      'Elevated reads require an open moderation case.',
      'case_required',
    );
  }
}

/**
 * A verification agent sees identity decisions. They do NOT see conversations, children's
 * details, or a family's discovery activity. Least privilege, applied to our own staff.
 */
export function assertVerificationAgentAccess(session: Session): void {
  assertRole(session, 'verification_agent', 'admin');
}
