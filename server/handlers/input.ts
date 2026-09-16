import { BadRequestError } from '../http/errors';

/**
 * Body field accessors.
 *
 * Every handler reads its input through these rather than casting the parsed
 * JSON, because the request body is attacker-controlled and `as SomeInput` is a
 * lie the compiler cannot catch. Each accessor either returns the right type or
 * throws a 400 naming the field.
 *
 * Deliberately not a schema library: the surface is small, the rules are mostly
 * "string, bounded" and "one of this literal set", and a dependency here would
 * have to be audited like anything else on the trust boundary.
 */

export function str(body: Record<string, unknown>, field: string, opts: { max?: number } = {}): string {
  const value = body[field];
  if (typeof value !== 'string') throw new BadRequestError(`Expected a value for ${field}.`, field);
  if (opts.max !== undefined && value.length > opts.max) {
    throw new BadRequestError(`${field} is too long.`, field, 'too_long');
  }
  return value;
}

export function optionalStr(
  body: Record<string, unknown>,
  field: string,
  opts: { max?: number } = {},
): string | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return str(body, field, opts);
}

export function num(body: Record<string, unknown>, field: string, min: number, max: number): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestError(`Expected a number for ${field}.`, field);
  }
  if (value < min || value > max) {
    throw new BadRequestError(`${field} must be between ${min} and ${max}.`, field, 'out_of_range');
  }
  return value;
}

export function optionalNum(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return num(body, field, min, max);
}

export function bool(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') throw new BadRequestError(`Expected true or false for ${field}.`, field);
  return value;
}

export function optionalBool(body: Record<string, unknown>, field: string): boolean | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return bool(body, field);
}

/** One of a fixed set. This is what keeps a status column from taking junk. */
export function literal<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestError(`${field} must be one of: ${allowed.join(', ')}.`, field, 'bad_enum');
  }
  return value as T;
}

export function optionalLiteral<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return literal(body, field, allowed);
}

/** Bounded array. The cap is what stops a 10,000-element interest list. */
export function arr(body: Record<string, unknown>, field: string, maxLength = 100): unknown[] {
  const value = body[field];
  if (!Array.isArray(value)) throw new BadRequestError(`Expected a list for ${field}.`, field);
  if (value.length > maxLength) {
    throw new BadRequestError(`${field} has too many entries.`, field, 'too_many');
  }
  return value;
}

export function optionalArr(
  body: Record<string, unknown>,
  field: string,
  maxLength = 100,
): unknown[] | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return arr(body, field, maxLength);
}

export function strArr(body: Record<string, unknown>, field: string, maxLength = 100): string[] {
  return arr(body, field, maxLength).map((v, i) => {
    if (typeof v !== 'string') throw new BadRequestError(`${field}[${i}] must be a string.`, field);
    return v;
  });
}

export function obj(body: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = body[field];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError(`Expected an object for ${field}.`, field);
  }
  return value as Record<string, unknown>;
}

export function optionalObj(
  body: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  return obj(body, field);
}
