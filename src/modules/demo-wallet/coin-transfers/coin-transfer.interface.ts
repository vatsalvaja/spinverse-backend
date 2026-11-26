import { CoinTransferType } from './coin-transfer.constants';

export interface CoinParty {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** A coin movement in the hierarchy as returned by the API. */
export interface CoinTransferView {
  id: string;
  type: CoinTransferType;
  amount: number;
  sender: CoinParty;
  receiver: CoinParty;
  /** The master this movement belongs to. */
  masterId: string;
  /** Null for MASTER_ALLOCATION: the Super Admin issues coins and has no balance to reduce. */
  senderBalanceAfter: number | null;
  receiverBalanceAfter: number;
  /** The wallet-ledger entries (wallet_transactions) this transfer created. */
  senderTransactionId: string | null;
  receiverTransactionId: string;
  note: string | null;
  createdAt: Date;
}

export interface CoinAllocationResult {
  transfer: CoinTransferView;
  /** True when the idempotency key had been used before: nothing new was posted. */
  replayed: boolean;
}

export interface CoinTransferFilter {
  type?: CoinTransferType;
  /** Only movements that belong to this master. */
  masterId?: string;
  senderId?: string;
  receiverId?: string;
  /** Movements where this account is the sender or the receiver. */
  participantId?: string;
  from?: Date;
  to?: Date;
}

/** Wallet figures for one master. All amounts are coins. */
export interface MasterCoinSummary {
  /** Spendable balance (the master's wallet). */
  balance: number;
  /** Everything the Super Admin ever allocated to this master. */
  totalReceived: number;
  /** Net coins handed to clients (allocations minus coins returned from deleted clients). */
  totalDistributed: number;
}
