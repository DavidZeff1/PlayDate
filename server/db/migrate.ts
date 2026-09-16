/**
 * Apply schema.sql.
 *
 * Deliberately not a migration framework. At this stage the schema is one file
 * of idempotent `CREATE … IF NOT EXISTS`, which is the right amount of
 * machinery for a database with no production data in it yet.
 *
 * Before the first real user exists, replace this with a versioned migration
 * tool (Drizzle Kit, Atlas, or plain numbered SQL files in a `migrations`
 * table). A child-safety service cannot take "drop and recreate" as an option,
 * and you want the discipline in place before you need it.
 *
 *   npm run db:migrate
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from './client';

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const ddl = await readFile(join(here, 'schema.sql'), 'utf8');

  // Split on semicolons at end-of-line, which is sufficient for this file:
  // it contains no functions, triggers or dollar-quoted bodies.
  const statements = ddl
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`Applying ${statements.length} statements…`);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log('Schema applied.');
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
