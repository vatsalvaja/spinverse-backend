import { DemoWallet, WalletTransaction } from '@prisma/client';
import { WalletStatus } from '../enums/wallet-status.enum';
import { WalletTransactionDirection } from '../enums/wallet-transaction-direction.enum';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';

/** One operation to post to the ledger. `amount` is always positive; the type decides the direction. */
export interface LedgerEntry {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  /** Globally unique. Posting the same key again returns the original entry. */
  idempotencyKey: string;
  description: string;
  /** Game row id (games.id), session and round, when the entry comes from play. */
  gameId?: string;
  sessionId?: string;
  roundId?: string;
  /** The administrator, for admin adjustments. */
  actorId?: string;
}

export interface PostedEntry {
  transaction: WalletTransaction;
  /** True when the idempotency key had been used before and nothing new was posted. */
  replayed: boolean;
}

export type WalletWithUser = DemoWallet & {
  user: { id: string; name: string; email: string; role: string; isActive: boolean };
};

export interface TransactionFilter {
  userId?: string;
  type?: WalletTransactionType;
  direction?: WalletTransactionDirection;
  gameId?: string;
  from?: Date;
  to?: Date;
}

export interface WalletListFilter {
  /** Case-insensitive match on the player's name or e-mail. */
  search?: string;
  status?: WalletStatus;
}

/** A wallet as returned by the API. */
export interface WalletView {
  id: string;
  userId: string;
  /** Free demo credits that can be spent now. */
  balance: number;
  totalCredited: number;
  totalDebited: number;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminWalletView extends WalletView {
  user: { id: string; name: string; email: string; role: string; isActive: boolean };
}

/** A ledger entry as returned by the API. Admin views add the idempotency key and the acting administrator. */
export interface TransactionView {
  id: string;
  walletId: string;
  userId: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameId: string | null;
  sessionId: string | null;
  roundId: string | null;
  description: string;
  createdAt: Date;
  idempotencyKey?: string;
  actorId?: string | null;
}

export interface AdjustmentResult {
  transaction: TransactionView;
  /** The wallet balance after the adjustment. */
  balance: number;
  /** True when the same idempotency key had already been processed: nothing new was posted. */
  replayed: boolean;
}

export interface WalletStats {
  wallets: { total: number; active: number; suspended: number };
  totalBalance: number;
  totalCredited: number;
  totalDebited: number;
  /** totalCredited - totalDebited - totalBalance. Always 0 when the books balance. */
  discrepancy: number;
  byType: { type: WalletTransactionType; direction: WalletTransactionDirection; count: number; totalAmount: number }[];
  range: { from: Date | null; to: Date | null };
}
