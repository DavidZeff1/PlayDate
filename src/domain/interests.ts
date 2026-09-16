import type { InterestDefinition, InterestCategory } from './types';
import type { TFunc, TKey } from '../i18n/types';

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

/**
 * The translation key for an interest, not its English label.
 *
 * The `label` on each catalog entry is the English fallback and a readable anchor for
 * developers; what the UI renders is `t(interestKey(id))`. Keeping the key derivation
 * here means adding an interest is one catalog row plus two dictionary entries, and the
 * typecheck catches a missing translation.
 */
export function interestKey(id: string): TKey {
  return `interest.${id}` as TKey;
}

export function interestLabel(id: string, t: TFunc): string {
  return BY_ID.has(id) ? t(interestKey(id)) : id;
}

export function interestEmoji(id: string): string {
  return BY_ID.get(id)?.emoji ?? '•';
}

export function categoryKey(c: InterestCategory): TKey {
  return `cat.${c}` as TKey;
}

export function interestsByCategory(): Array<{
  category: InterestCategory;
  labelKey: TKey;
  interests: InterestDefinition[];
}> {
  const order: InterestCategory[] = ['creative', 'active', 'games', 'outdoors', 'learning', 'social'];
  return order.map((category) => ({
    category,
    labelKey: categoryKey(category),
    interests: INTEREST_CATALOG.filter((i) => i.category === category),
  }));
}

export function importanceKey(n: number): TKey {
  return `importance.${n}` as TKey;
}

export function enthusiasmKey(n: number): TKey {
  return `enthusiasm.${n}` as TKey;
}

export function importanceLabel(n: number, t: TFunc): string {
  return t(importanceKey(n));
}

export function enthusiasmLabel(n: number, t: TFunc): string {
  return t(enthusiasmKey(n));
}

/** Star-control labels, keyed 1–5, for the active locale. */
export function importanceLabels(t: TFunc): Record<number, string> {
  return { 1: t('importance.1'), 2: t('importance.2'), 3: t('importance.3'), 4: t('importance.4'), 5: t('importance.5') };
}

export function enthusiasmLabels(t: TFunc): Record<number, string> {
  return { 1: t('enthusiasm.1'), 2: t('enthusiasm.2'), 3: t('enthusiasm.3'), 4: t('enthusiasm.4'), 5: t('enthusiasm.5') };
}

/** Activity options offered when planning a playdate. */
export const PLAYDATE_ACTIVITIES: Array<{ id: string; labelKey: TKey; emoji: string }> = [
  { id: 'playground', labelKey: 'activity.playground', emoji: '🛝' },
  { id: 'park', labelKey: 'activity.park', emoji: '🌳' },
  { id: 'lego', labelKey: 'activity.lego', emoji: '🧱' },
  { id: 'board_games', labelKey: 'activity.board_games', emoji: '🎲' },
  { id: 'swimming', labelKey: 'activity.swimming', emoji: '🏊' },
  { id: 'sports', labelKey: 'activity.sports', emoji: '⚽' },
  { id: 'crafts', labelKey: 'activity.crafts', emoji: '🎨' },
  { id: 'baking', labelKey: 'activity.baking', emoji: '🧁' },
  { id: 'museum', labelKey: 'activity.museum', emoji: '🏛️' },
  { id: 'other', labelKey: 'activity.other', emoji: '✨' },
];
