/**
 * Token-bucket rate limiting.
 *
 * In the prototype this runs in the mock API so the limits are demonstrable and
 * testable. In production the same limits belong at the edge AND per-account on the
 * server — a client-side limiter stops honest accidents, never an attacker.
 *
 * The limits below are the anti-abuse spine of the product: they are what stops a
 * single account from enumerating every family in a city, blasting connection requests,
 * or brute-forcing a verification code.
 */

export interface RateLimitRule {
  /** Bucket capacity — how many actions in a burst. */
  capacity: number;
  /** Tokens restored per minute. */
  refillPerMinute: number;
  /** Message shown when the limit bites. Written for a parent, not an engineer. */
  message: string;
}

export const RATE_LIMITS = {
  login: {
    capacity: 5,
    refillPerMinute: 1,
    message: 'Too many sign-in attempts. Please wait a minute and try again.',
  },
  verification_code: {
    capacity: 5,
    refillPerMinute: 1,
    message: 'Too many code attempts. Please wait before trying again.',
  },
  /**
   * The important one. Unsolicited contact is the primary abuse vector on a platform
   * like this, so requests are deliberately scarce: a genuine parent sends a handful a
   * week, an abuser wants hundreds.
   */
  connection_request: {
    capacity: 10,
    refillPerMinute: 0.2,
    message:
      'You have sent a lot of connection requests recently. This limit exists to keep PlayDate free of unwanted contact — please try again later.',
  },
  message_send: {
    capacity: 30,
    refillPerMinute: 3,
    message: 'You are sending messages very quickly. Please slow down.',
  },
  /**
   * Caps profile enumeration. A parent browses tens of families; a scraper wants
   * thousands.
   */
  discovery_page: {
    capacity: 60,
    refillPerMinute: 10,
    message: 'You have loaded a lot of families in a short time. Please pause a moment.',
  },
  report_submit: {
    capacity: 10,
    refillPerMinute: 0.5,
    message: 'You have submitted several reports. Each one is reviewed — please allow time.',
  },
  playdate_propose: {
    capacity: 10,
    refillPerMinute: 1,
    message: 'Too many playdate proposals at once. Please wait a moment.',
  },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly limitKey: string;

  constructor(message: string, retryAfterSeconds: number, limitKey: string) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitKey = limitKey;
  }
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /** Injectable clock keeps tests deterministic. */
  constructor(private now: () => number = () => Date.now()) {}

  /**
   * Consume one token, or throw. Scoped per (actor, action) so one family hitting a
   * limit never affects another.
   */
  consume(actorId: string, key: RateLimitKey): void {
    const rule = RATE_LIMITS[key];
    const id = `${actorId}:${key}`;
    const t = this.now();
    const bucket = this.buckets.get(id) ?? { tokens: rule.capacity, lastRefill: t };

    const elapsedMinutes = (t - bucket.lastRefill) / 60_000;
    bucket.tokens = Math.min(rule.capacity, bucket.tokens + elapsedMinutes * rule.refillPerMinute);
    bucket.lastRefill = t;

    if (bucket.tokens < 1) {
      const secondsToOne = ((1 - bucket.tokens) / rule.refillPerMinute) * 60;
      this.buckets.set(id, bucket);
      throw new RateLimitError(rule.message, Math.ceil(secondsToOne), key);
    }

    bucket.tokens -= 1;
    this.buckets.set(id, bucket);
  }

  /** Non-consuming check, for showing remaining allowance in the UI. */
  remaining(actorId: string, key: RateLimitKey): number {
    const rule = RATE_LIMITS[key];
    const bucket = this.buckets.get(`${actorId}:${key}`);
    if (!bucket) return rule.capacity;
    const elapsedMinutes = (this.now() - bucket.lastRefill) / 60_000;
    return Math.floor(Math.min(rule.capacity, bucket.tokens + elapsedMinutes * rule.refillPerMinute));
  }

  reset(): void {
    this.buckets.clear();
  }
}
