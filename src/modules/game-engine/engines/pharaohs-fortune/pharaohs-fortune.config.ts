/**
 * Pharaoh's Fortune rules and settings.
 *
 * FROM THE EXISTING GAME (`game-packages/pharaohs-fortune/src/mock.ts`): the 5x3 grid, the five paylines,
 * the paytable, the Pharaoh wild, the Golden Scarab scatter, the jackpot, the scatter rewards and the bet
 * steps.
 *
 * NOT DEFINED BY THE EXISTING GAME: how often each symbol appears. The existing game plays a fixed demo
 * script. `SYMBOL_WEIGHTS` below is therefore an ASSUMPTION: change it here (and bump
 * `PHARAOH_ENGINE_VERSION`). docs/game-algorithms/pharaohs-fortune.md explains it and gives the exact
 * return that follows from it.
 */
export const PHARAOH_GAME_ID = 'pharaohs-fortune';
export const PHARAOH_ENGINE_VERSION = '1.0.0';

export const REELS = 5;
export const ROWS = 3;

export const BET_STEPS: readonly number[] = [10, 20, 50, 100, 250, 500];

/** Each payline lists the row (0 = top, 2 = bottom) used on every reel. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], // 1 middle
  [0, 0, 0, 0, 0], // 2 top
  [2, 2, 2, 2, 2], // 3 bottom
  [0, 1, 2, 1, 0], // 4 V
  [2, 1, 0, 1, 2], // 5 inverted V
];

export type SymbolId = 'pharaoh' | 'scarab' | 'anubis' | 'horus' | 'sphinx' | 'temple' | 'coin' | 'jewel';
export type PayingSymbol = Exclude<SymbolId, 'pharaoh' | 'scarab'>;

/** Multiples of the bet for 3, 4 and 5 matching symbols from the left (the Pharaoh substitutes). */
export const PAYTABLE: Record<PayingSymbol, readonly [number, number, number]> = {
  anubis: [4, 12, 40],
  horus: [4, 12, 40],
  sphinx: [4, 12, 40],
  temple: [2, 5, 15],
  coin: [2, 5, 15],
  jewel: [2, 5, 15],
};

/** Five Pharaohs on one payline. */
export const JACKPOT_MULTIPLIER = 1000;

/** Rewards for Golden Scarabs anywhere on screen (4 or more use the "4" row). */
export const SCATTER_REWARDS = {
  3: { multiplier: 5, freeSpins: 10 },
  4: { multiplier: 20, freeSpins: 15 },
} as const;

/** Display level of a spin by its line-win multiplier (kept from the existing game). */
export const WIN_LEVELS: readonly { level: string; from: number }[] = [
  { level: 'jackpot', from: JACKPOT_MULTIPLIER },
  { level: 'mega', from: 80 },
  { level: 'super', from: 30 },
  { level: 'big', from: 10 },
  { level: 'nice', from: 0.0001 },
];

/* ------------------------------- ASSUMPTIONS ------------------------------- */

/**
 * ASSUMPTION - relative chance of each symbol in every cell (cells are independent). Every paying symbol
 * is equally likely; the wild is rare; the scatter is a little more common than the wild.
 * Order: [pharaoh, scarab, anubis, horus, sphinx, temple, coin, jewel].
 */
export const SYMBOL_ORDER: readonly SymbolId[] = ['pharaoh', 'scarab', 'anubis', 'horus', 'sphinx', 'temple', 'coin', 'jewel'];
export const SYMBOL_WEIGHTS: readonly number[] = [1, 2, 10, 10, 10, 10, 10, 10];

/** ASSUMPTION - during free spins the Golden Scarab does not appear (the existing game's free spins never contain scatters). */
export const FREE_SPIN_SYMBOL_WEIGHTS: readonly number[] = SYMBOL_WEIGHTS.map((weight, index) =>
  SYMBOL_ORDER[index] === 'scarab' ? 0 : weight,
);
