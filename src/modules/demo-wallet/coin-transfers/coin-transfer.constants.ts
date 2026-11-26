export { CoinTransferType } from '@prisma/client';

/** Smallest and largest single allocation (coins, at most 2 decimals, like every wallet amount). */
export const COIN_ALLOCATION_MIN = 0.01;
export const COIN_ALLOCATION_MAX = 1_000_000_000;
export const COIN_NOTE_MAX_LENGTH = 200;

export const COIN_ERRORS = {
  MASTER_NOT_FOUND: 'Master not found',
  CLIENT_NOT_FOUND: 'Client not found',
  MASTER_INACTIVE: 'This master is deactivated, so it cannot receive coins',
  CLIENT_INACTIVE: 'This client is deactivated, so it cannot receive coins',
  SENDER_INACTIVE: 'Your account is not active',
  FORBIDDEN: 'You are not allowed to allocate coins this way',
  INSUFFICIENT: 'You do not have enough coins for this allocation',
  IDEMPOTENCY_CONFLICT: 'This idempotency key was already used for a different allocation',
  INVALID_RANGE: '"from" must not be after "to"',
} as const;

export const COIN_MESSAGES = {
  ALLOCATED: 'Coins allocated successfully',
  REPLAYED: 'This allocation was already processed; the original result is returned',
  LISTED: 'Coin transactions fetched successfully',
  WALLET: 'Coin wallet fetched successfully',
} as const;
