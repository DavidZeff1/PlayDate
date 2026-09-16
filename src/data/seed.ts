import type {
  Account,
  AvailabilitySlot,
  Child,
  ChildInterest,
  Family,
  FamilyMembership,
  FamilyPreferences,
  Importance,
  ParentIdentity,
  ParentProfile,
  PrivacySettings,
  PlaydateStyle,
  DayOfWeek,
  TimeBlock,
} from '../domain/types';
import { buildTrustSignals } from '../domain/trust/signals';

/**
 * Mock data for the prototype.
 *
 * Realistic enough to demonstrate matching properly: families here differ in area,
 * travel radius, availability, child ages, interests AND in how their parents weight
 * those things — so the weighted matcher produces genuinely different orderings for
 * different viewers, rather than one global ranking.
 *
 * All names, areas and details are fictional.
 */

const AVATAR_COLORS = [
  '#7C6BF0', '#E08A5C', '#3FA796', '#D96A8B', '#5A8FD6',
  '#C4843C', '#6FA85C', '#B06BC8', '#4FA0B5', '#D4693F',
];

function iso(daysAgo: number): string {
  const d = new Date('2026-09-16T09:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function slots(spec: Array<[DayOfWeek, TimeBlock[]]>): AvailabilitySlot[] {
  return spec.flatMap(([day, blocks]) => blocks.map((block) => ({ day, block })));
}

function interest(id: string, enthusiasm: Importance, importance: Importance): ChildInterest {
  return { interestId: id, enthusiasm, importance };
}

function prefs(p: Partial<FamilyPreferences> & { weights?: Partial<FamilyPreferences['weights']> }): FamilyPreferences {
  return {
    maxTravelKm: p.maxTravelKm ?? 8,
    ageFlexibilityYears: p.ageFlexibilityYears ?? 2,
    styles: p.styles ?? ['parents_stay', 'public_places_only'],
    preferredActivities: p.preferredActivities ?? ['playground', 'park'],
    weights: {
      interests: p.weights?.interests ?? 4,
      age: p.weights?.age ?? 4,
      distance: p.weights?.distance ?? 3,
      availability: p.weights?.availability ?? 3,
      style: p.weights?.style ?? 3,
    },
  };
}

function privacy(p: Partial<PrivacySettings> = {}): PrivacySettings {
  return {
    location: p.location ?? 'general_area',
    childName: p.childName ?? 'first_name',
    childPhotos: p.childPhotos ?? 'hidden',
    childAges: p.childAges ?? 'exact',
    discoverable: p.discoverable ?? true,
    availabilityDetail: p.availabilityDetail ?? 'summary',
    parentBio: p.parentBio ?? 'connected_only',
    requireVerifiedToRequest: p.requireVerifiedToRequest ?? true,
  };
}

// ---------------------------------------------------------------------------
// Family definitions
// ---------------------------------------------------------------------------

interface SeedSpec {
  id: string;
  surname: string;
  parent: { first: string; legalFirst: string; legalLast: string; bio: string; dob: string };
  area: string;
  neighborhood: string;
  loc: { lat: number; lng: number };
  about: string;
  languages: string[];
  children: Array<{
    first: string;
    nickname?: string;
    age: number;
    pronouns?: string;
    notes?: string;
    energy: Importance;
    sociability: Importance;
    interests: ChildInterest[];
  }>;
  availability: AvailabilitySlot[];
  preferences: FamilyPreferences;
  privacy: PrivacySettings;
  joinedDaysAgo: number;
  completedPlaydates: number;
  verification?: ParentIdentity['verificationStatus'];
  styles?: PlaydateStyle[];
}

const SPECS: SeedSpec[] = [
  // ---- The viewer's own family (demo account) ----------------------------
  {
    id: 'fam_cohen',
    surname: 'Cohen',
    parent: {
      first: 'Maya',
      legalFirst: 'Maya',
      legalLast: 'Cohen',
      bio: "Mum of two. We're usually at the playground on Saturday afternoons. Happy to host once we've met.",
      dob: '1988-04-12',
    },
    area: 'Jerusalem area',
    neighborhood: 'Rehavia',
    loc: { lat: 31.7717, lng: 35.21 },
    about:
      "We moved to the neighbourhood last year and the kids are still finding their feet. Looking for relaxed, regular playdates rather than anything organised.",
    languages: ['Hebrew', 'English'],
    children: [
      {
        first: 'Noa',
        age: 8,
        pronouns: 'she/her',
        notes: 'Loves building things and will happily spend two hours on one LEGO set.',
        energy: 3,
        sociability: 3,
        interests: [
          interest('lego', 5, 5),
          interest('drawing', 4, 4),
          interest('swimming', 3, 3),
          interest('board_games', 5, 5),
          interest('reading', 4, 3),
          interest('animals', 3, 2),
        ],
      },
      {
        first: 'Daniel',
        nickname: 'Dani',
        age: 6,
        pronouns: 'he/him',
        notes: 'Very into dinosaurs right now. Needs a bit of warm-up time with new children.',
        energy: 4,
        sociability: 2,
        interests: [
          interest('dinosaurs', 5, 5),
          interest('football', 3, 2),
          interest('lego', 4, 4),
          interest('playground', 5, 4),
          interest('trains', 3, 2),
        ],
      },
    ],
    availability: slots([
      ['fri', ['afternoon']],
      ['sat', ['morning', 'afternoon']],
      ['tue', ['afternoon']],
      ['thu', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 8,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'public_places_only', 'small_groups'],
      weights: { interests: 5, age: 5, distance: 4, availability: 4, style: 3 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name', childAges: 'exact' }),
    joinedDaysAgo: 540,
    completedPlaydates: 7,
  },

  // ---- Strong matches ----------------------------------------------------
  {
    id: 'fam_levi',
    surname: 'Levi',
    parent: {
      first: 'Tamar',
      legalFirst: 'Tamar',
      legalLast: 'Levi',
      bio: 'One daughter, endlessly curious. We like parks and rainy-day board games in equal measure.',
      dob: '1986-11-03',
    },
    area: 'Jerusalem area',
    neighborhood: 'Katamon',
    loc: { lat: 31.762, lng: 35.208 },
    about: 'Small family, quiet weekends. Happy to meet at a playground or a museum.',
    languages: ['Hebrew', 'English', 'French'],
    children: [
      {
        first: 'Yael',
        age: 8,
        pronouns: 'she/her',
        notes: 'Reads constantly, and has strong opinions about board game rules.',
        energy: 2,
        sociability: 3,
        interests: [
          interest('lego', 5, 5),
          interest('drawing', 5, 4),
          interest('board_games', 5, 5),
          interest('swimming', 4, 3),
          interest('reading', 5, 4),
        ],
      },
    ],
    availability: slots([
      ['fri', ['afternoon']],
      ['sat', ['afternoon']],
      ['tue', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 6,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'public_places_only'],
      weights: { interests: 5, age: 4, distance: 3, availability: 4, style: 3 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 400,
    completedPlaydates: 11,
  },
  {
    id: 'fam_mizrahi',
    surname: 'Mizrahi',
    parent: {
      first: 'Avi',
      legalFirst: 'Avraham',
      legalLast: 'Mizrahi',
      bio: 'Dad of three. Our house is loud and there is usually a football involved.',
      dob: '1984-02-20',
    },
    area: 'Jerusalem area',
    neighborhood: 'Baka',
    loc: { lat: 31.755, lng: 35.223 },
    about: 'Three kids, lots of energy. We are outside most weekends — parks, football, bikes.',
    languages: ['Hebrew'],
    children: [
      {
        first: 'Itai',
        age: 9,
        energy: 5,
        sociability: 5,
        notes: 'Football first, everything else second.',
        interests: [
          interest('football', 5, 5),
          interest('basketball', 4, 3),
          interest('cycling', 4, 3),
          interest('playground', 4, 3),
          interest('video_games', 3, 1),
        ],
      },
      {
        first: 'Shira',
        age: 7,
        energy: 4,
        sociability: 4,
        interests: [
          interest('drawing', 5, 4),
          interest('dance', 4, 3),
          interest('crafts', 4, 4),
          interest('playground', 5, 3),
          interest('lego', 3, 2),
        ],
      },
      {
        first: 'Omer',
        age: 5,
        energy: 5,
        sociability: 3,
        interests: [
          interest('dinosaurs', 5, 4),
          interest('trains', 4, 3),
          interest('playground', 5, 4),
          interest('water_play', 4, 2),
        ],
      },
    ],
    availability: slots([
      ['fri', ['morning', 'afternoon']],
      ['sat', ['morning', 'afternoon']],
      ['sun', ['afternoon']],
      ['wed', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 12,
      ageFlexibilityYears: 3,
      styles: ['public_places_only', 'parents_stay', 'home_visits_ok'],
      preferredActivities: ['sports', 'park', 'playground'],
      weights: { interests: 3, age: 3, distance: 4, availability: 5, style: 2 },
    }),
    privacy: privacy({ location: 'neighborhood', childName: 'first_name' }),
    joinedDaysAgo: 220,
    completedPlaydates: 14,
  },
  {
    id: 'fam_peretz',
    surname: 'Peretz',
    parent: {
      first: 'Noam',
      legalFirst: 'Noam',
      legalLast: 'Peretz',
      bio: 'Two boys who build, break and rebuild. We are big on LEGO and dinosaurs in this house.',
      dob: '1989-07-30',
    },
    area: 'Jerusalem area',
    neighborhood: 'German Colony',
    loc: { lat: 31.762, lng: 35.218 },
    about:
      'Weekday afternoons work best for us. Both boys are happiest with a project to work on together.',
    languages: ['Hebrew', 'English'],
    children: [
      {
        first: 'Eitan',
        age: 7,
        energy: 3,
        sociability: 3,
        notes: 'Will build with anyone who takes LEGO seriously.',
        interests: [
          interest('lego', 5, 5),
          interest('dinosaurs', 4, 4),
          interest('science', 4, 3),
          interest('board_games', 4, 3),
          interest('puzzles', 3, 2),
        ],
      },
      {
        first: 'Yonatan',
        nickname: 'Yoni',
        age: 5,
        energy: 4,
        sociability: 4,
        interests: [
          interest('dinosaurs', 5, 5),
          interest('trains', 5, 3),
          interest('playground', 4, 3),
          interest('lego', 4, 4),
        ],
      },
    ],
    availability: slots([
      ['tue', ['afternoon']],
      ['thu', ['afternoon']],
      ['sat', ['morning', 'afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 7,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'home_visits_ok', 'structured_activities', 'small_groups'],
      preferredActivities: ['lego', 'crafts', 'park'],
      weights: { interests: 5, age: 4, distance: 3, availability: 3, style: 4 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name', childPhotos: 'on_request' }),
    joinedDaysAgo: 310,
    completedPlaydates: 9,
  },
  {
    id: 'fam_katz',
    surname: 'Katz',
    parent: {
      first: 'Dina',
      legalFirst: 'Dina',
      legalLast: 'Katz',
      bio: 'Mum of one. We are a quiet, one-on-one sort of family rather than a big group one.',
      dob: '1990-01-15',
    },
    area: 'Jerusalem area',
    neighborhood: 'Nachlaot',
    loc: { lat: 31.783, lng: 35.214 },
    about:
      'My daughter finds big groups overwhelming, so we are looking for one calm friend rather than a crowd.',
    languages: ['Hebrew', 'English'],
    children: [
      {
        first: 'Talia',
        nickname: 'Tali',
        age: 8,
        energy: 2,
        sociability: 2,
        notes: 'Takes a while to warm up, then does not stop talking.',
        interests: [
          interest('drawing', 5, 5),
          interest('crafts', 5, 4),
          interest('reading', 5, 4),
          interest('board_games', 4, 4),
          interest('animals', 4, 3),
          interest('quiet_play', 5, 5),
        ],
      },
    ],
    availability: slots([
      ['sat', ['afternoon']],
      ['mon', ['afternoon']],
      ['thu', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 5,
      ageFlexibilityYears: 1,
      styles: ['parents_stay', 'small_groups', 'public_places_only'],
      preferredActivities: ['crafts', 'park'],
      weights: { interests: 4, age: 5, distance: 4, availability: 3, style: 5 },
    }),
    privacy: privacy({
      location: 'general_area',
      childName: 'nickname',
      childAges: 'range',
      availabilityDetail: 'summary',
    }),
    joinedDaysAgo: 95,
    completedPlaydates: 3,
  },
  {
    id: 'fam_amar',
    surname: 'Amar',
    parent: {
      first: 'Rachel',
      legalFirst: 'Rachel',
      legalLast: 'Amar',
      bio: 'Two swimmers and a lot of wet towels. We are at the pool most weeks.',
      dob: '1987-09-08',
    },
    area: 'Jerusalem area',
    neighborhood: 'Beit HaKerem',
    loc: { lat: 31.778, lng: 35.19 },
    about: 'Active family, happiest outdoors or in the water. Always up for a park meet.',
    languages: ['Hebrew', 'Arabic'],
    children: [
      {
        first: 'Lior',
        age: 9,
        energy: 5,
        sociability: 4,
        interests: [
          interest('swimming', 5, 5),
          interest('football', 4, 3),
          interest('cycling', 4, 3),
          interest('nature', 4, 3),
          interest('board_games', 3, 2),
        ],
      },
      {
        first: 'Adi',
        age: 6,
        energy: 4,
        sociability: 5,
        interests: [
          interest('swimming', 5, 4),
          interest('water_play', 5, 4),
          interest('playground', 5, 4),
          interest('music', 3, 2),
        ],
      },
    ],
    availability: slots([
      ['fri', ['morning']],
      ['sat', ['morning', 'afternoon']],
      ['sun', ['afternoon']],
      ['tue', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 10,
      ageFlexibilityYears: 2,
      styles: ['public_places_only', 'parents_stay', 'drop_off_ok'],
      preferredActivities: ['swimming', 'park', 'sports'],
      weights: { interests: 4, age: 3, distance: 3, availability: 4, style: 2 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 180,
    completedPlaydates: 6,
  },
  {
    id: 'fam_shapiro',
    surname: 'Shapiro',
    parent: {
      first: 'Ben',
      legalFirst: 'Benjamin',
      legalLast: 'Shapiro',
      bio: 'One son, one very patient dog. We are new to Jerusalem and would like to meet people.',
      dob: '1991-05-22',
    },
    area: 'Jerusalem area',
    neighborhood: 'Talpiot',
    loc: { lat: 31.748, lng: 35.22 },
    about: 'Just arrived from abroad. Our son is keen to meet children his age who like building things.',
    languages: ['English', 'Hebrew'],
    children: [
      {
        first: 'Ari',
        age: 7,
        energy: 3,
        sociability: 3,
        notes: 'Bilingual, a bit shy in Hebrew but fine once he is playing.',
        interests: [
          interest('lego', 5, 5),
          interest('coding', 4, 3),
          interest('space', 5, 4),
          interest('board_games', 4, 4),
          interest('reading', 3, 2),
        ],
      },
    ],
    availability: slots([
      ['sat', ['morning', 'afternoon']],
      ['sun', ['afternoon']],
      ['wed', ['afternoon']],
      ['thu', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 9,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'public_places_only', 'home_visits_ok'],
      preferredActivities: ['lego', 'playground', 'museum'],
      weights: { interests: 5, age: 4, distance: 2, availability: 3, style: 3 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name', parentBio: 'discovery' }),
    joinedDaysAgo: 40,
    completedPlaydates: 1,
  },
  {
    id: 'fam_bendavid',
    surname: 'Ben-David',
    parent: {
      first: 'Orly',
      legalFirst: 'Orly',
      legalLast: 'Ben-David',
      bio: 'Twins, seven years old, opposite personalities. Never a dull afternoon.',
      dob: '1985-12-01',
    },
    area: 'Jerusalem area',
    neighborhood: 'Ein Kerem',
    loc: { lat: 31.765, lng: 35.156 },
    about: 'We are a bit further out but happy to travel. Weekends are ours.',
    languages: ['Hebrew', 'English'],
    children: [
      {
        first: 'Maayan',
        age: 7,
        energy: 2,
        sociability: 2,
        interests: [
          interest('drawing', 5, 4),
          interest('reading', 5, 4),
          interest('crafts', 4, 3),
          interest('animals', 5, 4),
          interest('quiet_play', 4, 4),
        ],
      },
      {
        first: 'Gilad',
        age: 7,
        energy: 5,
        sociability: 5,
        interests: [
          interest('football', 5, 4),
          interest('gymnastics', 4, 3),
          interest('playground', 5, 4),
          interest('group_games', 5, 3),
          interest('lego', 3, 2),
        ],
      },
    ],
    availability: slots([
      ['fri', ['afternoon']],
      ['sat', ['morning', 'afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 15,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'public_places_only', 'small_groups'],
      weights: { interests: 4, age: 4, distance: 2, availability: 4, style: 3 },
    }),
    privacy: privacy({ location: 'approximate_distance', childName: 'first_name' }),
    joinedDaysAgo: 260,
    completedPlaydates: 8,
  },
  {
    id: 'fam_friedman',
    surname: 'Friedman',
    parent: {
      first: 'Sarit',
      legalFirst: 'Sarit',
      legalLast: 'Friedman',
      bio: 'Music, mess and a lot of baking. Our kitchen is usually the main event.',
      dob: '1988-08-18',
    },
    area: 'Jerusalem area',
    neighborhood: 'Rehavia',
    loc: { lat: 31.7725, lng: 35.2115 },
    about: 'We love hosting. Baking afternoons are a bit of a tradition here.',
    languages: ['Hebrew', 'English', 'Russian'],
    children: [
      {
        first: 'Ruth',
        nickname: 'Rutie',
        age: 9,
        energy: 3,
        sociability: 4,
        interests: [
          interest('baking', 5, 5),
          interest('music', 5, 4),
          interest('drawing', 4, 3),
          interest('board_games', 4, 3),
          interest('dance', 3, 2),
        ],
      },
      {
        first: 'Amit',
        age: 6,
        energy: 4,
        sociability: 3,
        interests: [
          interest('baking', 4, 3),
          interest('playground', 5, 4),
          interest('dinosaurs', 4, 4),
          interest('music', 4, 3),
        ],
      },
    ],
    availability: slots([
      ['sun', ['afternoon']],
      ['tue', ['afternoon']],
      ['thu', ['afternoon']],
      ['sat', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 6,
      ageFlexibilityYears: 3,
      styles: ['home_visits_ok', 'parents_stay', 'structured_activities'],
      preferredActivities: ['baking', 'crafts', 'playground'],
      weights: { interests: 4, age: 2, distance: 5, availability: 3, style: 4 },
    }),
    privacy: privacy({ location: 'neighborhood', childName: 'first_name' }),
    joinedDaysAgo: 150,
    completedPlaydates: 5,
  },
  {
    id: 'fam_azoulay',
    surname: 'Azoulay',
    parent: {
      first: 'Eli',
      legalFirst: 'Eliyahu',
      legalLast: 'Azoulay',
      bio: 'Chess, puzzles and long walks. We are a slow-paced family.',
      dob: '1983-03-25',
    },
    area: 'Jerusalem area',
    neighborhood: 'French Hill',
    loc: { lat: 31.804, lng: 35.238 },
    about: 'Two children who would happily spend an afternoon over a chessboard.',
    languages: ['Hebrew', 'French'],
    children: [
      {
        first: 'Daniel',
        age: 10,
        energy: 2,
        sociability: 3,
        interests: [
          interest('chess', 5, 5),
          interest('puzzles', 5, 4),
          interest('reading', 4, 3),
          interest('science', 4, 3),
          interest('board_games', 5, 4),
        ],
      },
      {
        first: 'Michal',
        age: 8,
        energy: 3,
        sociability: 3,
        interests: [
          interest('board_games', 5, 5),
          interest('drawing', 4, 4),
          interest('reading', 5, 4),
          interest('nature', 3, 2),
          interest('lego', 4, 3),
        ],
      },
    ],
    availability: slots([
      ['sat', ['afternoon']],
      ['mon', ['afternoon']],
      ['wed', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 12,
      ageFlexibilityYears: 2,
      styles: ['parents_stay', 'small_groups', 'structured_activities'],
      preferredActivities: ['board_games', 'park'],
      weights: { interests: 5, age: 3, distance: 2, availability: 3, style: 4 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name', childAges: 'range' }),
    joinedDaysAgo: 330,
    completedPlaydates: 12,
  },
  {
    id: 'fam_hadad',
    surname: 'Hadad',
    parent: {
      first: 'Michal',
      legalFirst: 'Michal',
      legalLast: 'Hadad',
      bio: 'One small dinosaur enthusiast and one baby. Short outings suit us best.',
      dob: '1992-06-14',
    },
    area: 'Jerusalem area',
    neighborhood: 'Baka',
    loc: { lat: 31.7535, lng: 35.2205 },
    about: 'With a baby in tow we keep things short and close to home. Mornings are easiest.',
    languages: ['Hebrew'],
    children: [
      {
        first: 'Uri',
        age: 5,
        energy: 4,
        sociability: 3,
        interests: [
          interest('dinosaurs', 5, 5),
          interest('playground', 5, 4),
          interest('trains', 4, 3),
          interest('water_play', 3, 2),
          interest('lego', 3, 3),
        ],
      },
    ],
    availability: slots([
      ['fri', ['morning']],
      ['sun', ['morning']],
      ['tue', ['morning']],
      ['sat', ['morning']],
    ]),
    preferences: prefs({
      maxTravelKm: 4,
      ageFlexibilityYears: 2,
      styles: ['public_places_only', 'parents_stay'],
      preferredActivities: ['playground', 'park'],
      weights: { interests: 4, age: 4, distance: 5, availability: 5, style: 3 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 70,
    completedPlaydates: 2,
  },
  {
    id: 'fam_green',
    surname: 'Green',
    parent: {
      first: 'Jonathan',
      legalFirst: 'Jonathan',
      legalLast: 'Green',
      bio: 'Two teenagers-in-training. Sport, screens and negotiating bedtimes.',
      dob: '1980-10-09',
    },
    area: 'Jerusalem area',
    neighborhood: 'Ramot',
    loc: { lat: 31.825, lng: 35.195 },
    about: 'Older children — sports and video games mostly. Looking for similar ages.',
    languages: ['English', 'Hebrew'],
    children: [
      {
        first: 'Sam',
        age: 13,
        energy: 4,
        sociability: 4,
        interests: [
          interest('basketball', 5, 5),
          interest('video_games', 5, 4),
          interest('football', 4, 3),
          interest('coding', 3, 2),
        ],
      },
      {
        first: 'Ella',
        age: 12,
        energy: 3,
        sociability: 4,
        interests: [
          interest('dance', 5, 4),
          interest('music', 5, 4),
          interest('video_games', 3, 2),
          interest('reading', 4, 3),
        ],
      },
    ],
    availability: slots([
      ['sat', ['afternoon', 'evening']],
      ['thu', ['evening']],
    ]),
    preferences: prefs({
      maxTravelKm: 15,
      ageFlexibilityYears: 2,
      styles: ['drop_off_ok', 'public_places_only'],
      weights: { interests: 3, age: 5, distance: 2, availability: 3, style: 2 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 410,
    completedPlaydates: 10,
  },
  {
    id: 'fam_nachman',
    surname: 'Nachman',
    parent: {
      first: 'Shai',
      legalFirst: 'Shai',
      legalLast: 'Nachman',
      bio: 'Gilo-based, two kids, big on nature walks and anything with animals.',
      dob: '1986-02-11',
    },
    area: 'Jerusalem area',
    neighborhood: 'Gilo',
    loc: { lat: 31.729, lng: 35.187 },
    about: 'We are a bit out of the centre. Happy to travel for the right match.',
    languages: ['Hebrew', 'English'],
    children: [
      {
        first: 'Roni',
        age: 8,
        energy: 4,
        sociability: 4,
        interests: [
          interest('animals', 5, 5),
          interest('nature', 5, 4),
          interest('drawing', 4, 3),
          interest('swimming', 4, 3),
          interest('gardening', 3, 2),
        ],
      },
      {
        first: 'Tom',
        age: 6,
        energy: 5,
        sociability: 4,
        interests: [
          interest('playground', 5, 4),
          interest('dinosaurs', 4, 4),
          interest('animals', 5, 4),
          interest('cycling', 4, 3),
        ],
      },
    ],
    availability: slots([
      ['fri', ['afternoon']],
      ['sat', ['morning', 'afternoon']],
      ['sun', ['afternoon']],
    ]),
    preferences: prefs({
      maxTravelKm: 14,
      ageFlexibilityYears: 2,
      styles: ['public_places_only', 'parents_stay'],
      preferredActivities: ['park', 'playground', 'nature'],
      weights: { interests: 4, age: 4, distance: 2, availability: 4, style: 3 },
    }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 200,
    completedPlaydates: 4,
  },
  {
    id: 'fam_barak',
    surname: 'Barak',
    parent: {
      first: 'Hila',
      legalFirst: 'Hila',
      legalLast: 'Barak',
      bio: 'New here and still setting up our profile.',
      dob: '1993-04-04',
    },
    area: 'Jerusalem area',
    neighborhood: 'Pisgat Zeev',
    loc: { lat: 31.829, lng: 35.24 },
    about: 'Just joined.',
    languages: ['Hebrew'],
    children: [
      {
        first: 'Noga',
        age: 7,
        energy: 3,
        sociability: 3,
        interests: [interest('drawing', 4, 4), interest('lego', 4, 4), interest('playground', 4, 3)],
      },
    ],
    availability: slots([
      ['sat', ['afternoon']],
      ['wed', ['afternoon']],
    ]),
    preferences: prefs({ maxTravelKm: 10, ageFlexibilityYears: 2 }),
    privacy: privacy({ location: 'general_area', childName: 'first_name' }),
    joinedDaysAgo: 4,
    completedPlaydates: 0,
    // Demonstrates the "verification pending" state in discovery and admin queue.
    verification: 'pending',
  },
];

// ---------------------------------------------------------------------------
// Materialise
// ---------------------------------------------------------------------------

export interface SeedData {
  accounts: Account[];
  parentProfiles: ParentProfile[];
  parentIdentities: ParentIdentity[];
  memberships: FamilyMembership[];
  families: Family[];
  /** The demo account signed in by the "explore the prototype" button. */
  demoAccountId: string;
  demoFamilyId: string;
}

export function buildSeed(): SeedData {
  const accounts: Account[] = [];
  const parentProfiles: ParentProfile[] = [];
  const parentIdentities: ParentIdentity[] = [];
  const memberships: FamilyMembership[] = [];
  const families: Family[] = [];

  SPECS.forEach((spec, index) => {
    const parentId = `par_${spec.id.slice(4)}`;
    const accountId = `acc_${spec.id.slice(4)}`;
    const verification = spec.verification ?? 'verified';
    const joinedAt = iso(spec.joinedDaysAgo);
    const accountAgeMonths = Math.max(0, Math.round(spec.joinedDaysAgo / 30));

    accounts.push({
      id: accountId,
      email: `${spec.parent.first.toLowerCase()}@example.com`,
      // Prototype only — see SECURITY.md. No real password is ever stored client-side.
      passwordHash: 'mock$prototype-only',
      phone: `+972-5X-XXX-${String(1000 + index).slice(-4)}`,
      role: 'parent',
      state: verification === 'verified' ? 'active' : 'verification_required',
      emailVerified: true,
      phoneVerified: true,
      twoFactorEnabled: index % 3 === 0,
      createdAt: joinedAt,
      lastLoginAt: iso(Math.min(3, spec.joinedDaysAgo)),
      safetyGuidelinesAcceptedAt: joinedAt,
    });

    parentProfiles.push({
      id: parentId,
      accountId,
      displayName: spec.parent.first,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      bio: spec.parent.bio,
      joinedAt,
      trustSignals: buildTrustSignals({
        emailVerified: true,
        phoneVerified: true,
        idVerification: verification,
        twoFactorEnabled: index % 3 === 0,
        secondaryParentVerified: index % 4 === 0,
        profileComplete: true,
        accountAgeMonths,
        completedPlaydates: spec.completedPlaydates,
        upheldReports: 0,
        joinedAt,
      }),
    });

    // PRIVATE. Never projected — see domain/privacy/redaction.ts.
    parentIdentities.push({
      parentId,
      legalFirstName: spec.parent.legalFirst,
      legalLastName: spec.parent.legalLast,
      dateOfBirth: spec.parent.dob,
      verificationProvider: 'mock',
      verificationProviderRef: verification === 'verified' ? `mock_ver_${index}` : undefined,
      verificationStatus: verification,
      verificationUpdatedAt: joinedAt,
      preciseLocation: spec.loc,
    });

    memberships.push({ parentId, familyId: spec.id, role: 'primary', joinedAt });

    const children: Child[] = spec.children.map((c, ci) => ({
      id: `chi_${spec.id.slice(4)}_${ci}`,
      familyId: spec.id,
      firstName: c.first,
      nickname: c.nickname,
      age: c.age,
      pronouns: c.pronouns,
      interests: c.interests,
      notes: c.notes,
      temperament: { energy: c.energy, sociability: c.sociability },
      avatarColor: AVATAR_COLORS[(index + ci + 3) % AVATAR_COLORS.length],
    }));

    families.push({
      id: spec.id,
      displayName: `The ${spec.surname} Family`,
      generalArea: spec.area,
      neighborhood: spec.neighborhood,
      // Approximate centroid, deliberately distinct from `preciseLocation` above.
      approxLocation: spec.loc,
      about: spec.about,
      children,
      preferences: spec.preferences,
      availability: spec.availability,
      privacy: spec.privacy,
      createdAt: joinedAt,
      verificationStatus: verification,
      accountState: verification === 'verified' ? 'active' : 'verification_required',
      languages: spec.languages,
    });
  });

  return {
    accounts,
    parentProfiles,
    parentIdentities,
    memberships,
    families,
    demoAccountId: 'acc_cohen',
    demoFamilyId: 'fam_cohen',
  };
}

/** Public, non-sensitive meeting places suggested when planning. */
export const SUGGESTED_PLACES = [
  { label: 'Gan Sacher — main playground', kind: 'playground' as const, area: 'Nachlaot', isPublic: true },
  { label: 'Gan HaPaamon (Liberty Bell Park)', kind: 'park' as const, area: 'German Colony', isPublic: true },
  { label: 'Rehavia Park playground', kind: 'playground' as const, area: 'Rehavia', isPublic: true },
  { label: 'Jerusalem Botanical Gardens', kind: 'park' as const, area: 'Givat Ram', isPublic: true },
  { label: 'Bloomfield Science Museum', kind: 'museum' as const, area: 'Givat Ram', isPublic: true },
  { label: 'Katamon community centre', kind: 'community_center' as const, area: 'Katamon', isPublic: true },
  { label: 'Baka neighbourhood pool', kind: 'pool' as const, area: 'Baka', isPublic: true },
  { label: 'Emek Refaim café with play corner', kind: 'cafe' as const, area: 'German Colony', isPublic: true },
];
