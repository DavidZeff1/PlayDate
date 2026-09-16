import type { InterestDefinition, InterestCategory } from './types';

/**
 * Controlled interest vocabulary.
 *
 * Deliberately a fixed catalog rather than free-text tags. Free text would let the
 * matching surface become a channel for sorting families by sensitive attributes
 * (religion, ethnicity, school as a demographic proxy) through creative tagging. A
 * closed list keeps matching to playdate-relevant, parent-declared preferences only.
 *
 * Adding an interest is a product decision with a review step, not a user action.
 */
export const INTEREST_CATALOG: InterestDefinition[] = [
  // creative
  { id: 'lego', label: 'LEGO & building', emoji: '🧱', category: 'creative', typicalAges: [3, 14] },
  { id: 'drawing', label: 'Drawing & painting', emoji: '🎨', category: 'creative', typicalAges: [2, 16] },
  { id: 'crafts', label: 'Arts & crafts', emoji: '✂️', category: 'creative', typicalAges: [3, 14] },
  { id: 'music', label: 'Music & singing', emoji: '🎵', category: 'creative', typicalAges: [2, 18] },
  { id: 'baking', label: 'Baking & cooking', emoji: '🧁', category: 'creative', typicalAges: [4, 16] },
  { id: 'dressup', label: 'Dress-up & pretend play', emoji: '🎭', category: 'creative', typicalAges: [2, 9] },

  // active
  { id: 'football', label: 'Football', emoji: '⚽', category: 'active', typicalAges: [4, 18] },
  { id: 'basketball', label: 'Basketball', emoji: '🏀', category: 'active', typicalAges: [5, 18] },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', category: 'active', typicalAges: [3, 18] },
  { id: 'cycling', label: 'Cycling & scooters', emoji: '🚲', category: 'active', typicalAges: [3, 16] },
  { id: 'dance', label: 'Dance', emoji: '💃', category: 'active', typicalAges: [3, 18] },
  { id: 'gymnastics', label: 'Gymnastics & climbing', emoji: '🤸', category: 'active', typicalAges: [3, 16] },
  { id: 'martial_arts', label: 'Martial arts', emoji: '🥋', category: 'active', typicalAges: [5, 18] },

  // games
  { id: 'board_games', label: 'Board games', emoji: '🎲', category: 'games', typicalAges: [4, 18] },
  { id: 'puzzles', label: 'Puzzles', emoji: '🧩', category: 'games', typicalAges: [2, 14] },
  { id: 'card_games', label: 'Card games', emoji: '🃏', category: 'games', typicalAges: [5, 18] },
  { id: 'chess', label: 'Chess', emoji: '♟️', category: 'games', typicalAges: [5, 18] },
  { id: 'video_games', label: 'Video games', emoji: '🎮', category: 'games', typicalAges: [6, 18] },

  // outdoors
  { id: 'playground', label: 'Playgrounds', emoji: '🛝', category: 'outdoors', typicalAges: [1, 11] },
  { id: 'nature', label: 'Nature & hiking', emoji: '🌳', category: 'outdoors', typicalAges: [2, 18] },
  { id: 'animals', label: 'Animals & pets', emoji: '🐕', category: 'outdoors', typicalAges: [2, 16] },
  { id: 'gardening', label: 'Gardening', emoji: '🌱', category: 'outdoors', typicalAges: [3, 14] },
  { id: 'water_play', label: 'Water play', emoji: '💦', category: 'outdoors', typicalAges: [1, 10] },

  // learning
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦕', category: 'learning', typicalAges: [2, 10] },
  { id: 'space', label: 'Space & astronomy', emoji: '🚀', category: 'learning', typicalAges: [4, 16] },
  { id: 'science', label: 'Science experiments', emoji: '🔬', category: 'learning', typicalAges: [5, 16] },
  { id: 'reading', label: 'Reading & stories', emoji: '📚', category: 'learning', typicalAges: [2, 16] },
  { id: 'coding', label: 'Coding & robotics', emoji: '🤖', category: 'learning', typicalAges: [6, 18] },
  { id: 'trains', label: 'Trains & vehicles', emoji: '🚂', category: 'learning', typicalAges: [2, 9] },

  // social
  { id: 'imaginative', label: 'Imaginative play', emoji: '🪄', category: 'social', typicalAges: [2, 10] },
  { id: 'group_games', label: 'Group games', emoji: '🙌', category: 'social', typicalAges: [4, 14] },
  { id: 'quiet_play', label: 'Quiet one-on-one play', emoji: '🧸', category: 'social', typicalAges: [2, 12] },
];

const BY_ID = new Map(INTEREST_CATALOG.map((i) => [i.id, i]));

export function getInterest(id: string): InterestDefinition | undefined {
  return BY_ID.get(id);
}

export function interestLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

export function interestEmoji(id: string): string {
  return BY_ID.get(id)?.emoji ?? '•';
}

export const CATEGORY_LABELS: Record<InterestCategory, string> = {
  creative: 'Creative',
  active: 'Active & sport',
  games: 'Games',
  outdoors: 'Outdoors',
  learning: 'Learning & curiosity',
  social: 'Play style',
};

export function interestsByCategory(): Array<{
  category: InterestCategory;
  label: string;
  interests: InterestDefinition[];
}> {
  const order: InterestCategory[] = ['creative', 'active', 'games', 'outdoors', 'learning', 'social'];
  return order.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    interests: INTEREST_CATALOG.filter((i) => i.category === category),
  }));
}

export const IMPORTANCE_LABELS: Record<number, string> = {
  1: 'Not important',
  2: 'Slight preference',
  3: 'Important',
  4: 'Very important',
  5: 'Extremely important',
};

export const ENTHUSIASM_LABELS: Record<number, string> = {
  1: 'Will join in',
  2: 'Quite likes it',
  3: 'Really enjoys it',
  4: 'Loves it',
  5: "It's their favourite thing",
};

/** Activity options offered when planning a playdate. */
export const PLAYDATE_ACTIVITIES = [
  { id: 'playground', label: 'Playground', emoji: '🛝' },
  { id: 'park', label: 'Park meet-up', emoji: '🌳' },
  { id: 'lego', label: 'LEGO & building', emoji: '🧱' },
  { id: 'board_games', label: 'Board games', emoji: '🎲' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'sports', label: 'Sports & ball games', emoji: '⚽' },
  { id: 'crafts', label: 'Arts & crafts', emoji: '🎨' },
  { id: 'baking', label: 'Baking together', emoji: '🧁' },
  { id: 'museum', label: 'Museum or exhibition', emoji: '🏛️' },
  { id: 'other', label: 'Something else', emoji: '✨' },
] as const;
