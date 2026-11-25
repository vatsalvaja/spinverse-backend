import { DemoWallet, WalletTransaction } from '@prisma/client';
import { AdminWalletView, TransactionView, WalletView, WalletWithUser } from '../interfaces/demo-wallet.interface';

export function toWalletView(wallet: DemoWallet): WalletView {
  return {
    id: wallet.id,
    userId: wallet.userId,
    balance: wallet.balance.toNumber(),
    totalCredited: wallet.totalCredited.toNumber(),
    totalDebited: wallet.totalDebited.toNumber(),
    status: wallet.status,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

export function toAdminWalletView(wallet: WalletWithUser): AdminWalletView {
  return { ...toWalletView(wallet), user: wallet.user };
}

/** Players see their own entries without internal fields; `admin` adds the idempotency key and the acting admin. */
export function toTransactionView(transaction: WalletTransaction, admin = false): TransactionView {
  return {
    id: transaction.id,
    walletId: transaction.walletId,
    userId: transaction.userId,
    type: transaction.type,
    direction: transaction.direction,
    amount: transaction.amount.toNumber(),
    balanceBefore: transaction.balanceBefore.toNumber(),
    balanceAfter: transaction.balanceAfter.toNumber(),
    gameId: transaction.gameId,
    sessionId: transaction.sessionId,
    roundId: transaction.roundId,
    description: transaction.description,
    createdAt: transaction.createdAt,
    ...(admin ? { idempotencyKey: transaction.idempotencyKey, actorId: transaction.actorId } : {}),
  };
}
