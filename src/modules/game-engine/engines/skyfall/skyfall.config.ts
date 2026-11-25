/**
 * SKYFALL rules and settings.
 *
 * FROM THE EXISTING GAME (`game-packages/skyfall/src/engine.ts`): the growth curve, the stake limits,
 * the two bet panels, the automatic cash-out range and how cash-outs and crashes are settled.
 *
 * NOT DEFINED BY THE EXISTING GAME: where the plane crashes. The existing game only plays a fixed demo
 * script of crash points. The two values under "ASSUMPTIONS" decide the random crash point; change them
 * here and bump `SKYFALL_ENGINE_VERSION`. The documentation (docs/game-algorithms/skyfall.md) explains
 * exactly what they do.
 */
export const SKYFALL_GAME_ID = 'skyfall';
export const SKYFALL_ENGINE_VERSION = '1.0.0';

/** Time between the bet being placed and the multiplier starting to grow. */
export const TAKEOFF_MS = 1500;

/** The multiplier is exp(GROWTH x seconds of flight). */
export const GROWTH = 0.105;

export const MIN_STAKE = 1;
export const MAX_STAKE = 10000;

/** Range of the optional automatic cash-out multiplier. */
export const AUTO_CASHOUT_MIN = 1.01;
export const AUTO_CASHOUT_MAX = 1000;

/** Two bet panels, numbered 0 and 1. */
export const PANELS = [0, 1] as const;

/* ------------------------------- ASSUMPTIONS ------------------------------- */

/**
 * ASSUMPTION - share of every possible cash-out target that the game keeps on average. 0.05 makes
 * 5% of rounds crash instantly at 1.00x, which matches the existing demo script (2 instant crashes
 * in its 40 rounds). Every cash-out target then returns 95% in the long run.
 */
export const HOUSE_EDGE = 0.05;

/** ASSUMPTION - the plane never flies past this multiplier (the highest automatic cash-out the game allows). */
export const MAX_CRASH_MULTIPLIER = 1000;
