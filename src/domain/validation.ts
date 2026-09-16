/**
 * Input validation.
 *
 * Client-side validation is a UX affordance, never a security control — every rule here
 * MUST be re-applied server-side, because anything on the client can be bypassed. The
 * value of keeping them in the domain layer is that both sides can share one definition
 * once a real backend exists.
 */

import type { TKey } from '../i18n/types';

/**
 * Validators return a translation KEY (and values where the message is composed),
 * never an English sentence — the same reason the matching scorers do.
 */
export interface ValidationError {
  key: TKey;
  vars?: Record<string, string | number>;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, ValidationError>;
}

export function validate(
  rules: Array<[string, ValidationError | null]>,
): ValidationResult {
  const errors: Record<string, ValidationError> = {};
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

export function validateEmail(value: string): ValidationError | null {
  const v = value.trim();
  if (!v) return { key: 'val.email.required' };
  if (v.length > 254) return { key: 'val.email.tooLong' };
  if (!EMAIL_RE.test(v)) return { key: 'val.email.invalid' };
  return null;
}

export function validatePhone(value: string): ValidationError | null {
  const digits = value.replace(NON_DIGITS, '');
  if (!digits) return { key: 'val.phone.required' };
  if (digits.length < 8) return { key: 'val.phone.short' };
  if (digits.length > 15) return { key: 'val.phone.long' };
  return null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  labelKey: TKey;
  suggestionKeys: TKey[];
}

/**
 * Strength feedback only. The real defences are server-side: Argon2id hashing, a
 * breached-password check against a k-anonymity API, and rate-limited sign-in.
 * A strength meter that encourages `P@ssw0rd!` while accepting a long passphrase would
 * be actively harmful, so length is weighted most heavily here.
 */
export function passwordStrength(password: string): PasswordStrength {
  const suggestions: TKey[] = [];

  // Length gates everything. Character-class variety barely helps a short password
  // against modern offline cracking, so awarding points for it would let the meter
  // tell someone that `P@ss1!` is as good as a long passphrase — which is false, and
  // is precisely the advice that produced a generation of bad passwords.
  if (password.length < 10) {
    return { score: 0, labelKey: 'val.strength.0', suggestionKeys: ['val.sugg.length'] };
  }

  let score = 0;
  if (password.length >= 20) score += 4;
  else if (password.length >= 16) score += 3;
  else if (password.length >= 12) score += 2;
  else score += 1;

  if (password.length < 16) {
    suggestions.push('val.sugg.longer');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push('val.sugg.case');

  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1;
  else suggestions.push('val.sugg.number');

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('val.sugg.repeat');
  }

  const COMMON = ['password', '123456', 'qwerty', 'letmein', 'playdate', 'welcome', 'iloveyou'];
  if (COMMON.some((c) => password.toLowerCase().includes(c))) {
    score = 0;
    suggestions.length = 0;
    suggestions.push('val.sugg.common');
  }

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  return {
    score: clamped,
    labelKey: `val.strength.${clamped}` as TKey,
    suggestionKeys: suggestions,
  };
}

export function validatePassword(value: string): ValidationError | null {
  if (!value) return { key: 'val.password.required' };
  if (value.length < 10) return { key: 'val.password.short' };
  if (value.length > 200) return { key: 'val.password.long' };
  const { score } = passwordStrength(value);
  if (score < 2) return { key: 'val.password.weak' };
  return null;
}

export function validateRequired(value: string, labelKey: TKey): ValidationError | null {
  return value.trim() ? null : { key: 'val.field.required', vars: { label: labelKey } };
}

export function validateLength(
  value: string,
  labelKey: TKey,
  min: number,
  max: number,
): ValidationError | null {
  const v = value.trim();
  if (v.length < min) return { key: 'val.field.min', vars: { label: labelKey, n: min } };
  if (v.length > max) return { key: 'val.field.max', vars: { label: labelKey, n: max } };
  return null;
}

export function validateChildAge(age: number): ValidationError | null {
  if (!Number.isFinite(age)) return { key: 'val.age.required' };
  if (age < 1) return { key: 'val.age.min' };
  if (age > 17) return { key: 'val.age.max' };
  return null;
}

export function validateVerificationCode(value: string): ValidationError | null {
  const v = value.replace(/\s/g, '');
  if (!v) return { key: 'val.code.required' };
  if (!/^\d{6}$/.test(v)) return { key: 'val.code.format' };
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
