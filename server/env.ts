/**
 * Typed environment access.
 *
 * Every value is read once, at module load, and a missing required value throws
 * immediately rather than at the first request that happens to need it. A
 * serverless function that boots with no DATABASE_URL should fail loudly on
 * cold start, not silently 500 an hour later.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example, or set it in ` +
        `Vercel → Project Settings → Environment Variables.`,
    );
  }
  return value;
}

function flag(name: string): boolean {
  return (process.env[name] ?? '').toLowerCase() === 'true';
}

const vercelEnv = process.env.VERCEL_ENV ?? 'development';

export const env = {
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),

  /** Canonical origin, used for cookie scope and the same-origin check. */
  appOrigin:
    process.env.APP_ORIGIN ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),

  isProduction: vercelEnv === 'production',
  isPreview: vercelEnv === 'preview',

  /**
   * Demo sign-in and the simulated identity resolver.
   *
   * Hard-disabled in production regardless of the variable: shipping a button
   * that marks a parent "verified" without a check is the one thing this
   * codebase has consistently refused to do, and an env var typo should not be
   * able to enable it on a live service.
   */
  allowDemoMode: flag('ALLOW_DEMO_MODE') && vercelEnv !== 'production',

  seedDemoData: flag('SEED_DEMO_DATA'),
} as const;

export type Env = typeof env;
