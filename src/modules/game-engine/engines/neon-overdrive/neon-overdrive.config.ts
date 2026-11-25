/**
 * Neon Overdrive rules and settings.
 *
 * FROM THE EXISTING GAME (`game-packages/neon-overdrive/src/engine.ts` and `NeonOverdrive.tsx`): the 5x4
 * grid, the 12 paylines, the paytable, the Arc Reactor wild, the Overdrive Core (orb) symbol, the Hold &
 * Respin trigger (6+ cores), 3 respins that reset whenever a core lands, OVERDRIVE (x2) at 10 cores, the
 * Grand bonus (100x) for a full grid, how core points are paid, and the bet steps.
 *
 * NOT DEFINED BY THE EXISTING GAME (it plays a fixed demo script): how often each symbol appears, which
 * values the cores carry and how likely a core is to land on a respin. These are the ASSUMPTIONS below.
 * Change them here and bump `NEON_ENGINE_VERSION`. docs/game-algorithms/neon-overdrive.md explains them
 * and shows what return follows from them.
 */
export const NEON_GAME_ID = 'neon-overdrive';
export const NEON_ENGINE_VERSION = '1.0.0';

export const REELS = 5;
export const ROWS = 4;
export const CELLS = REELS * ROWS;

export const BET_STEPS: readonly number[] = [10, 20, 50, 100, 200, 500];

export type SymbolId = 'cell' | 'chip' | 'crystal' | 'visor' | 'drone' | 'reactor' | 'orb';
export type PaySymbol = Exclude<SymbolId, 'orb'>;

/** Each payline lists the row (0 = top, 3 = bottom) used on every reel. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 0, 0, 0, 0],
  [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3],
  [1, 0, 0, 0, 1],
  [2, 3, 3, 3, 2],
  [0, 0, 1, 2, 3],
  [3, 3, 2, 1, 0],
  [1, 2, 3, 2, 1],
  [2, 1, 0, 1, 2],
];

/** Multiples of the total bet for 3, 4 and 5 in a row. */
export const PAYS: Record<PaySymbol, readonly [number, number, number]> = {
  cell: [0.4, 1.2, 3],
  chip: [0.6, 2, 5],
  crystal: [1, 4, 10],
  visor: [2, 8, 25],
  drone: [4, 15, 50],
  reactor: [5, 25, 100],
};

export const HOLD_TRIGGER = 6;
export const OVERDRIVE_AT = 10;
export const OVERDRIVE_MULTIPLIER = 2;
export const GRAND_BONUS = 100;
export const START_RESPINS = 3;

/** Display level of a total by multiple of the bet (kept from the existing game). */
export const levelOf = (multiple: number): string =>
  multiple >= 90 ? 'jackpot' : multiple >= 40 ? 'mega' : multiple >= 14 ? 'super' : multiple >= 6 ? 'big' : multiple > 0 ? 'win' : 'none';

/* ------------------------------- ASSUMPTIONS ------------------------------- */

/**
 * ASSUMPTION - relative chance of each symbol in every cell (cells are independent). The weights add up to
 * 200, so the chances are 30% / 22.5% / 17.5% / 15% / 7.5% / 0.5% / 7%. Higher-paying symbols are rarer.
 *
 * HOW THEY WERE CHOSEN: the existing game does not define them. The paytable is generous, so many natural-looking
 * sets (for example equal chances) return well over 100%. Round-number sets were tried until one returned below
 * 100% with a Hold & Respin that triggers about once in 500 spins. This is a calibration for a demo, not a game
 * rule; the game owner should replace it with the intended design.
 * Order: [cell, chip, crystal, visor, drone, reactor, orb].
 */
export const SYMBOL_ORDER: readonly SymbolId[] = ['cell', 'chip', 'crystal', 'visor', 'drone', 'reactor', 'orb'];
export const SYMBOL_WEIGHTS: readonly number[] = [60, 45, 35, 30, 15, 1, 14];
export const ORB_WEIGHT = SYMBOL_WEIGHTS[SYMBOL_ORDER.indexOf('orb')];
export const TOTAL_SYMBOL_WEIGHT = SYMBOL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/**
 * ASSUMPTION - the values a core can carry (all appear in the existing game's demo script) and their chances:
 * proportional to 1 / value (small values are common, 40 is very rare).
 */
export const ORB_VALUES: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 40];
export const ORB_VALUE_WEIGHTS: readonly number[] = ORB_VALUES.map((value) => 120 / value);

/**
 * ASSUMPTION - during Hold & Respin every empty cell has the same chance to show a core as a base-game cell
 * does: ORB_WEIGHT / TOTAL_SYMBOL_WEIGHT (a respin is simply another spin of that cell).
 */
export const RESPIN_CORE_CHANCE = { numerator: ORB_WEIGHT, denominator: TOTAL_SYMBOL_WEIGHT };
