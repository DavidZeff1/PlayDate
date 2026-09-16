/**
 * Demo data.
 *
 * Writes a small set of fictional families with `is_demo = TRUE`, which
 * `loadFamiliesForDiscovery` hard-excludes. That flag is the point: once there
 * is one shared database, a seeded family is a row a real parent could
 * otherwise discover, and fictional children appearing in a real discovery feed
 * is exactly the kind of thing that destroys trust in a product like this.
 *
 * Refuses to run unless SEED_DEMO_DATA=true, and refuses outright in
 * production.
 *
 *   npm run db:seed
 */
import { env } from '../env';
import { sql, newId } from './client';
import { hashPassword } from '../auth/password';

interface DemoFamily {
  surname: string;
  area: string;
  neighborhood: string;
  lat: number;
  lng: number;
  languages: string[];
  about: string;
  children: Array<{
    firstName: string;
    age: number;
    pronouns: string;
    interests: Array<[string, number, number]>;
  }>;
}

const FAMILIES: DemoFamily[] = [
  {
    surname: 'Cohen',
    area: 'Jerusalem area',
    neighborhood: 'Rehavia',
    lat: 31.7742,
    lng: 35.2137,
    languages: ['Hebrew', 'English'],
    about: 'We moved to the neighbourhood last year and the kids are still finding their feet.',
    children: [
      { firstName: 'Noa', age: 8, pronouns: 'she/her', interests: [['lego', 5, 5], ['drawing', 4, 3], ['swimming', 3, 2]] },
      { firstName: 'Dani', age: 5, pronouns: 'he/him', interests: [['dinosaurs', 5, 4], ['board_games', 3, 2]] },
    ],
  },
  {
    surname: 'Levi',
    area: 'Jerusalem area',
    neighborhood: 'Nachlaot',
    lat: 31.7825,
    lng: 35.2094,
    languages: ['Hebrew'],
    about: 'Yael loves building things and is looking for someone to build with.',
    children: [
      { firstName: 'Yael', age: 8, pronouns: 'she/her', interests: [['lego', 5, 5], ['board_games', 4, 3], ['reading', 4, 2]] },
    ],
  },
  {
    surname: 'Katz',
    area: 'Jerusalem area',
    neighborhood: 'Baka',
    lat: 31.7561,
    lng: 35.2242,
    languages: ['Hebrew', 'English'],
    about: 'Tali is a bit shy but warms up quickly over a shared project.',
    children: [
      { firstName: 'Tali', age: 8, pronouns: 'she/her', interests: [['drawing', 5, 4], ['board_games', 4, 4]] },
    ],
  },
];

async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error('Refusing to seed demo data in production.');
  }
  if (!env.seedDemoData) {
    console.log('SEED_DEMO_DATA is not "true" — nothing to do.');
    return;
  }

  const existing = (await sql`SELECT 1 FROM families WHERE is_demo = TRUE LIMIT 1`) as unknown as unknown[];
  if (existing.length > 0) {
    console.log('Demo data already present. Delete it first if you want it rebuilt.');
    return;
  }

  // One shared password across demo accounts. These accounts exist only where
  // ALLOW_DEMO_MODE is on, and that is never production.
  const passwordHash = await hashPassword('playdate-demo-only');

  for (const [index, spec] of FAMILIES.entries()) {
    const accountId = newId('acc');
    const parentId = newId('par');
    const familyId = newId('fam');
    const email = `demo.${spec.surname.toLowerCase()}@playdate.invalid`;

    await sql`
      INSERT INTO accounts (id, email, password_hash, phone, role, state, email_verified, phone_verified)
      VALUES (${accountId}, ${email}, ${passwordHash}, '+972000000000', 'parent', 'active', TRUE, TRUE)
    `;
    await sql`
      INSERT INTO parent_profiles (id, account_id, display_name, avatar_color, bio)
      VALUES (${parentId}, ${accountId}, ${spec.surname}, '#7C6BF0', ${spec.about})
    `;
    await sql`
      INSERT INTO parent_identities (parent_id, legal_first_name, legal_last_name, verification_status, verification_provider, verification_updated_at)
      VALUES (${parentId}, 'Demo', ${spec.surname}, 'verified', 'mock', now())
    `;
    await sql`
      INSERT INTO families (
        id, display_name, general_area, neighborhood, approx_lat, approx_lng,
        about, languages, verification_status, account_state, is_demo
      ) VALUES (
        ${familyId}, ${`The ${spec.surname} Family`}, ${spec.area}, ${spec.neighborhood},
        ${spec.lat}, ${spec.lng}, ${spec.about}, ${spec.languages}, 'verified', 'active', TRUE
      )
    `;
    await sql`INSERT INTO family_preferences (family_id) VALUES (${familyId})`;
    await sql`INSERT INTO family_privacy (family_id) VALUES (${familyId})`;
    await sql`
      INSERT INTO family_memberships (parent_id, family_id, role)
      VALUES (${parentId}, ${familyId}, 'primary')
    `;

    for (const [day, block] of [
      ['fri', 'afternoon'],
      ['sat', 'afternoon'],
      ['sat', 'morning'],
    ] as const) {
      await sql`
        INSERT INTO family_availability (family_id, day, block)
        VALUES (${familyId}, ${day}, ${block}) ON CONFLICT DO NOTHING
      `;
    }

    for (const [childIndex, child] of spec.children.entries()) {
      const childId = newId('chi');
      await sql`
        INSERT INTO children (id, family_id, first_name, age, pronouns, avatar_color, sort_order)
        VALUES (${childId}, ${familyId}, ${child.firstName}, ${child.age}, ${child.pronouns}, '#3FA796', ${childIndex})
      `;
      for (const [interestId, enthusiasm, importance] of child.interests) {
        await sql`
          INSERT INTO child_interests (child_id, interest_id, enthusiasm, importance)
          VALUES (${childId}, ${interestId}, ${enthusiasm}, ${importance})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    console.log(`  seeded ${index + 1}/${FAMILIES.length}: The ${spec.surname} Family`);
  }

  console.log(`\nSeeded ${FAMILIES.length} demo families, all flagged is_demo = TRUE.`);
  console.log('They are excluded from discovery for real accounts by loadFamiliesForDiscovery.');
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
