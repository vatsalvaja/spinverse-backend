import { MasterCoinSummary } from '../../demo-wallet/coin-transfers/coin-transfer.interface';
import { SafeUser } from './user.interface';

/** A master as returned to the Super Admin: the account plus its coins and clients. */
export type MasterView = SafeUser & {
  wallet: MasterCoinSummary;
  clients: { total: number; active: number };
};

/** A client as returned to its master (or the Super Admin): the account plus its coin balance. */
export type ClientView = SafeUser & { balance: number };

export interface MasterSummaryRef {
  id: string;
  name: string;
  email: string;
}

export interface DeleteClientResult {
  id: string;
  deleted: true;
  /** Coins that were still in the client's wallet and went back to the master. */
  coinsReturned: number;
}

export interface SystemOverview {
  users: { total: number; active: number; byRole: Record<string, number> };
  coins: { totalIssued: number; totalDistributed: number; totalTransfers: number };
}
