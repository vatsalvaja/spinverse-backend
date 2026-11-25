/**
 * Atlantis Cascade rules and settings.
 *
 * FROM THE EXISTING GAME (`game-packages/atlantis-cascade/src/engine.ts` and `AtlantisCascade.tsx`): the
 * 6x5 grid, clusters of 5 or more touching symbols, the paytable, the Wild, how cluster sizes map to pay
 * levels, the cascade multipliers, the free-spins trigger and the multiplier growth in free spins, the
 * relative frequency of the eight paying symbols (`SYMBOL_WEIGHTS`) and the bet steps.
 *
 * NOT DEFINED BY THE EXISTING GAME (it plays a fixed demo script): how often Wilds and Scatters appear, how
 * strongly new symbols copy their neighbours ("clump"), and a safety limit on cascades. These are the
 * ASSUMPTIONS below. The return is VERY sensitive to the clump setting (see docs/game-algorithms/atlantis-cascade.md).
 * Change them here and bump `ATLANTIS_ENGINE_VERSION`.
 */
export const ATLANTIS_GAME_ID = 'atlantis-cascade';
export const ATLANTIS_ENGINE_VERSION = '1.0.0';

export const COLS = 6;
export const ROWS = 5;
export const MIN_CLUSTER = 5;

export const BET_STEPS: readonly number[] = [10, 25, 50, 100, 250, 500, 1000];

export type PayingSymbol = 'pearl' | 'trident' | 'crown' | 'eye' | 'amphora' | 'conch' | 'crystal' | 'scale';
export type SymbolId = PayingSymbol | 'wild' | 'scatter';

/** High to low. Clusters are found in this order, so rarer symbols claim shared Wilds first. */
export const PAYING_ORDER: readonly PayingSymbol[] = ['pearl', 'trident', 'crown', 'eye', 'amphora', 'conch', 'crystal', 'scale'];

/** Multiples of the bet for clusters of 5-6, 7-8, 9-11, 12-14 and 15+ symbols. */
export const PAY: Record<PayingSymbol, readonly number[]> = {
  pearl: [1.5, 4, 12, 40, 120],
  trident: [1.2, 3, 9, 30, 90],
  crown: [1, 2.5, 7, 22, 70],
  eye: [0.8, 2, 5, 16, 50],
  amphora: [0.5, 1.2, 3, 10, 30],
  conch: [0.4, 1, 2.5, 8, 24],
  crystal: [0.3, 0.8, 2, 6, 18],
  scale: [0.2, 0.5, 1.5, 4, 12],
};

/** Relative frequency of the paying symbols (from the existing game's generator). Same order as `SYMBOL_ORDER`. */
export const SYMBOL_ORDER: readonly PayingSymbol[] = ['scale', 'crystal', 'conch', 'amphora', 'eye', 'crown', 'trident', 'pearl'];
export const SYMBOL_WEIGHTS: readonly number[] = [16, 15, 14, 13, 10, 8, 7, 6];

/** Cascade multiplier in the base game: x1, x2, x3 ... capped at x10. */
export const BASE_MULTIPLIER_CAP = 10;
/** In free spins the multiplier carries over, grows by one per winning cascade and is capped at x25. */
export const FREE_MULTIPLIER_CAP = 25;

/** Four or more Scatters start free spins. */
export const FREE_SPINS_TRIGGER = 4;
export const freeSpinsFor = (scatters: number): number => (scatters >= 6 ? 15 : scatters === 5 ? 12 : 8);

/** Display tier of a spin by total multiple of the bet (kept from the existing game). */
export const tierOf = (x: number): string =>
  x >= 100 ? 'jackpot' : x >= 50 ? 'mega' : x >= 25 ? 'super' : x >= 10 ? 'big' : x > 0 ? 'normal' : 'none';

/* ------------------------------- ASSUMPTIONS ------------------------------- */

/** All chances below are parts per million (1,000,000 = always). */
export const PPM = 1_000_000;

/** ASSUMPTION - chance that a new symbol is a Wild (1.5%, between the 1% and 2% the existing demo script uses). */
export const WILD_PPM = 15_000;

/** ASSUMPTION - chance that a cell of the first board is a Scatter (2% per cell; none appear in free spins or refills). */
export const SCATTER_PPM = 20_000;

/**
 * ASSUMPTION - chance that a new symbol copies one of its already-placed neighbours (left or above) instead of
 * being drawn from the weights: 20%. The existing game uses this in its demo generator with values from 0.2 to
 * 0.66; 0.2 is the lowest it uses (the setting of its quiet spins). Without it, clusters are too rare to be
 * playable under this paytable.
 */
export const CLUMP_PPM = 200_000;

/** ASSUMPTION - safety limit on cascades per spin. Not a game rule; it only protects against a runaway loop. */
export const MAX_CASCADES = 100;
