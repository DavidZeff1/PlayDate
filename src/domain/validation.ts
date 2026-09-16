/**
 * Input validation.
 *
 * Client-side validation is a UX affordance, never a security control — every rule here
 * MUST be re-applied server-side, because anything on the client can be bypassed. The
 * value of keeping them in the domain layer is that both sides can share one definition
 * once a real backend exists.
 */

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

export function validate(rules: Array<[string, string | null]>): ValidationResult {
  const errors: Record<string, string> = {};
  for (const [field, error] of rules) {
    if (error) errors[field] = error;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Field validators
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NON_DIGITS = /[^0-9]/g;
const TRAILING_SPACE = /\s+$/;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address';
  if (v.length > 254) return 'That email address is too long';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return null;
}

export function validatePhone(value: string): string | null {
  const digits = value.replace(NON_DIGITS, '');
  if (!digits) return 'Enter your phone number';
  if (digits.length < 8) return 'That phone number looks too short';
  if (digits.length > 15) return 'That phone number looks too long';
  return null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
}

/**
 * Strength feedback only. The real defences are server-side: Argon2id hashing, a
 * breached-password check against a k-anonymity API, and rate-limited sign-in.
 * A strength meter that encourages `P@ssw0rd!` while accepting a long passphrase would
 * be actively harmful, so length is weighted most heavily here.
 */
export function passwordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];

  // Length gates everything. Character-class variety barely helps a short password
  // against modern offline cracking, so awarding points for it would let the meter
  // tell someone that `P@ss1!` is as good as a long passphrase — which is false, and
  // is precisely the advice that produced a generation of bad passwords.
  if (password.length < 10) {
    return {
      score: 0,
      label: 'Very weak',
      suggestions: ['Use at least 12 characters — length matters far more than symbols'],
    };
  }

  let score = 0;
  if (password.length >= 20) score += 4;
  else if (password.length >= 16) score += 3;
  else if (password.length >= 12) score += 2;
  else score += 1;

  if (password.length < 16) {
    suggestions.push('A longer passphrase is the single biggest improvement you can make');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push('Mix upper and lower case');

  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;
  else suggestions.push('Add a number or symbol');

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid repeated characters');
  }

  const COMMON = ['password', '123456', 'qwerty', 'letmein', 'playdate', 'welcome', 'iloveyou'];
  if (COMMON.some((c) => password.toLowerCase().includes(c))) {
    score = 0;
    suggestions.length = 0;
    suggestions.push('This contains a very common password — choose something unrelated');
  }

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: clamped, label: labels[clamped], suggestions };
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Choose a password';
  if (value.length < 10) return 'Use at least 10 characters';
  if (value.length > 200) return 'That password is too long';
  const { score } = passwordStrength(value);
  if (score < 2) return 'Choose a stronger password';
  return null;
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

export function validateLength(value: string, label: string, min: number, max: number): string | null {
  const v = value.trim();
  if (v.length < min) return `${label} must be at least ${min} characters`;
  if (v.length > max) return `${label} must be under ${max} characters`;
  return null;
}

export function validateChildAge(age: number): string | null {
  if (!Number.isFinite(age)) return 'Enter an age';
  if (age < 1) return 'Enter an age of 1 or above';
  if (age > 17) return 'PlayDate is for children up to 17';
  return null;
}

export function validateVerificationCode(value: string): string | null {
  const v = value.replace(/\s/g, '');
  if (!v) return 'Enter the 6-digit code';
  if (!/^\d{6}$/.test(v)) return 'The code is 6 digits';
  return null;
}

/**
 * Strip C0/C1 control characters.
 *
 * Done by codepoint rather than a regex literal: a control-character class in source
 * makes the file non-ASCII and fragile to tooling, and this is easier to read anyway.
 * Tab (9), newline (10) and carriage return (13) are kept — they are legitimate in a
 * multi-line note.
 */
function stripControlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isC0 = code < 32 && code !== 9 && code !== 10 && code !== 13;
    const isC1 = code >= 127 && code <= 159;
    if (!isC0 && !isC1) out += ch;
  }
  return out;
}

/**
 * Normalise free text before storage.
 *
 * React escapes on render, so this is not the XSS defence — it strips control characters
 * and caps length so a pathological value cannot break layout or bloat storage. The real
 * XSS position is: never use `dangerouslySetInnerHTML` (this codebase has zero uses), and
 * serve a strict Content-Security-Policy.
 */
export function sanitiseText(value: string, maxLength = 2000): string {
  return stripControlChars(value).replace(TRAILING_SPACE, '').slice(0, maxLength);
}
