import { WalletTransactionDirection } from '../enums/wallet-transaction-direction.enum';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';

export const WALLET_ROUTE = 'wallet';
export const ADMIN_WALLETS_ROUTE = 'admin';
export const WALLET_API_TAG = 'Demo Wallet';
export const ADMIN_WALLET_API_TAG = 'Admin - Demo Wallets';

/**
 * Free demo credits every player starts with. 5000 is the amount the existing games start with
 * (`demoBalance ?? 5000`). Demo credits have no cash value and can never be deposited, withdrawn,
 * bought or exchanged.
 */
export const DEMO_STARTING_CREDITS = 5000;

/** Limits for one administrative adjustment. */
export const ADMIN_ADJUSTMENT_MIN = 0.01;
export const ADMIN_ADJUSTMENT_MAX = 1_000_000;
export const ADJUSTMENT_REASON_MIN_LENGTH = 5;
export const ADJUSTMENT_REASON_MAX_LENGTH = 300;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

/** Which way each ledger entry type moves the balance. */
export const TRANSACTION_DIRECTION: Record<WalletTransactionType, WalletTransactionDirection> = {
  INITIAL_CREDIT: 'CREDIT',
  ADMIN_CREDIT: 'CREDIT',
  GAME_WINNING_CREDIT: 'CREDIT',
  GAME_REFUND: 'CREDIT',
  BONUS_CREDIT: 'CREDIT',
  ADMIN_DEBIT: 'DEBIT',
  GAME_ENTRY_DEBIT: 'DEBIT',
};

/** Types an administrator may choose when adding credits. */
export const ADMIN_CREDIT_TYPES: readonly WalletTransactionType[] = ['ADMIN_CREDIT', 'BONUS_CREDIT'];

export const WALLET_ERRORS = {
  NOT_FOUND: 'Demo wallet not found',
  USER_NOT_FOUND: 'User not found',
  NOT_ELIGIBLE: 'This account is not active, so it cannot have a demo wallet',
  SUSPENDED: 'This demo wallet is suspended',
  INSUFFICIENT: 'Not enough demo credits',
  INVALID_AMOUNT: 'The amount must be a positive number with at most 2 decimal places',
  IDEMPOTENCY_CONFLICT: 'This idempotency key was already used for a different operation',
  WRONG_TYPE: 'That transaction type cannot be used for this operation',
  SELF_ADJUSTMENT: 'Administrators cannot adjust their own wallet',
  INVALID_RANGE: '"from" must not be after "to"',
  REFUND_NO_ENTRY: 'There is no game entry to refund for this round',
  REFUND_ALREADY_PAID: 'This round already paid out winnings, so its entry cannot be refunded',
} as const;

export const WALLET_MESSAGES = {
  FETCHED: 'Demo wallet fetched successfully',
  BALANCE: 'Demo balance fetched successfully',
  TRANSACTIONS: 'Wallet transactions fetched successfully',
  WALLETS_LISTED: 'Demo wallets fetched successfully',
  ADJUSTED: 'Wallet adjusted successfully',
  STATS: 'Wallet statistics fetched successfully',
} as const;
