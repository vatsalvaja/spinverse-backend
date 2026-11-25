/**
 * The contract every game algorithm implements.
 *
 * An engine is plain TypeScript: no database, no HTTP, no framework. It receives the player's
 * bet, the engine's own carry-over session state and a random number generator, and returns the
 * result. Everything that matters (random draws, rules, winners, payouts) happens here, on the
 * server; the client only ever sends a bet or an action and displays what it is given.
 *
 * To add a game (KENO, HI-LO, PACHINKO, ...): write an engine that implements this interface in
 * `engines/<game>/`, add it to `GAME_ENGINE_LIST`, and register a game with the same `gameId`
 * in the catalog. Nothing else changes.
 */

/** Plain JSON object used for bets, results and states (stored as JSON in the database). */
export type JsonObject = Record<string, unknown>;

/** Source of random numbers handed to an engine. Engines must use nothing else for randomness. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive), without modulo bias. */
  int(maxExclusive: number): number;
  /** Uniform number in [0, 1) with 53 bits of precision. */
  float(): number;
  /** True with probability numerator / denominator. */
  chance(numerator: number, denominator: number): boolean;
  /** Index chosen with probability proportional to the integer weights. */
  weighted(weights: readonly number[]): number;
  /** Fisher-Yates shuffle; returns a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** How many random numbers were drawn so far (kept in the audit trail). */
  readonly draws: number;
}

export type RoundStatus = 'IN_PROGRESS' | 'SETTLED';

/** A validated bet: the stake to take from the player now, and the normalised bet to store. */
export interface PreparedBet {
  /** Demo credits to debit when the round starts (0 for a free spin). */
  stake: number;
  bet: JsonObject;
}

/** The outcome of starting a round, applying an action or resolving elapsed time. */
export interface RoundStep {
  status: RoundStatus;
  /** Demo credits to add to the player's balance because of this step. */
  credit: number;
  /** What the player may see. */
  result: JsonObject;
  /** Private data the engine needs to continue the round (shown only after settlement). */
  roundState: JsonObject;
  /** Carry-over state of the session after this step. */
  sessionState: JsonObject;
}

export interface StartRoundInput {
  /** The bet exactly as returned by `prepareBet`. */
  bet: JsonObject;
  stake: number;
  sessionState: JsonObject;
  rng: Rng;
  now: Date;
}

export interface ResumeRoundInput {
  bet: JsonObject;
  roundState: JsonObject;
  sessionState: JsonObject;
  now: Date;
}

export interface ActionInput extends ResumeRoundInput {
  action: JsonObject;
}

/** When the random seed of a settled round may be shown to the player. */
export type SeedRevealPolicy =
  /** As soon as the round is settled. */
  | 'ON_SETTLE'
  /** Only after the session has ended, because the seed also determines later rounds (e.g. a shuffled deck). */
  | 'ON_SESSION_END';

export interface GameEngine {
  /** Matches `Game.gameId` in the catalog. */
  readonly gameId: string;
  /** Bumped whenever the rules, the paytable or the generator change; stored with every round. */
  readonly engineVersion: string;
  readonly seedRevealPolicy: SeedRevealPolicy;

  /** Bet limits and options a client needs to build its bet UI. */
  describeRules(): JsonObject;
  /** State a brand-new session starts with. */
  createSessionState(): JsonObject;
  /** The part of the session state the player may see (e.g. free spins left). */
  describeSession(sessionState: JsonObject): JsonObject;
  /** Validates a client bet against this game's rules. Throws `EngineRuleError`. */
  prepareBet(rawBet: unknown, sessionState: JsonObject): PreparedBet;
  /** Draws everything random for the round and settles it, or leaves it open for actions. */
  startRound(input: StartRoundInput): RoundStep;
  /** Settles anything that elapsed time decides (e.g. a SKYFALL crash). Also used to read an open round. */
  resolveRound?(input: ResumeRoundInput): RoundStep;
  /** Player actions inside an open round (e.g. SKYFALL cash-out). */
  applyAction?(input: ActionInput): RoundStep;
}
