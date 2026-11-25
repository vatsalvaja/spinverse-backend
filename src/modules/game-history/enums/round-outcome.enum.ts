/**
 * What a SETTLED round meant for the player's credits (payout compared with stake):
 * WIN = got back more than staked, LOSS = got back less, EVEN = got back exactly the stake
 * (this includes a free spin that won nothing: 0 staked, 0 paid).
 */
export enum RoundOutcome {
  Win = 'WIN',
  Loss = 'LOSS',
  Even = 'EVEN',
}
