/**
 * TIGER CLASH rules, taken from the existing game (`game-packages/tiger-clash/src/engine.ts`).
 * Nothing here is assumed.
 */
export const TIGER_CLASH_GAME_ID = 'tiger-clash';
export const TIGER_CLASH_ENGINE_VERSION = '1.0.0';

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];
export type Side = 'tiger' | 'dragon' | 'tie';

export const SIDES: readonly Side[] = ['tiger', 'dragon', 'tie'];

/** Ranks 2-10 face value, J 11, Q 12, K 13, Ace 14 (ace is high). */
export const MIN_RANK = 2;
export const MAX_RANK = 14;

export const MIN_STAKE = 1;
export const MAX_STAKE = 10000;

/** What a bet returns per unit staked (the amount RETURNED to the player, not the net win). */
export const PAYOUT = {
  /** Backing the winning side (Tiger or Dragon). */
  win: 2,
  /** Backing Tie when the cards tie. */
  tie: 9,
  /** Backing Tiger or Dragon when the cards tie: half the stake comes back. */
  tieSurrender: 0.5,
} as const;
