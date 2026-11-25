/**
 * European Roulette rules. Everything here is taken from the existing game
 * (`game-packages/roulette/src/engine.ts`); nothing is assumed.
 */
export const ROULETTE_GAME_ID = 'roulette';
export const ROULETTE_ENGINE_VERSION = '1.0.0';

/** The European wheel, clockwise from the zero (37 pockets, single zero). */
export const POCKETS: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22,
  18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type BetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'sixline'
  | 'dozen' | 'column' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high';

/** Net winnings per unit staked; the winning stake itself is returned on top of this. */
export const PAYOUT: Record<BetType, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  sixline: 5,
  dozen: 2,
  column: 2,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,
  high: 1,
};

/** Highest total on one position (taken from the existing game). */
export const MAX_PER_POSITION = 10000;
/** Chip values the existing game offers. Server accepts any whole-number amount; these are advertised to clients. */
export const CHIPS = [1, 5, 10, 25, 100];
/** Protection against absurdly long bet lists (the layout has far fewer distinct positions). */
export const MAX_BET_ENTRIES = 500;
