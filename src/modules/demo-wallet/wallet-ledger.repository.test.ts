import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { D, FakeDb } from './fake-wallet-db.test';
import { LedgerEntry } from './interfaces/demo-wallet.interface';
import { WalletLedgerRepository } from './wallet-ledger.repository';
import {
  IdempotencyConflictError,
  InsufficientBalanceError,
  InvalidAmountError,
  WalletNotFoundError,
  WalletSuspendedError,
} from './wallet.errors';

const entry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  userId: 'user-1',
  type: 'GAME_ENTRY_DEBIT',
  amount: 100,
  idempotencyKey: 'key-0001',
  description: 'test',
  ...overrides,
});

describe('WalletLedgerRepository.post', () => {
  let db: FakeDb;
  let ledger: WalletLedgerRepository;
  const tx = () => db.tx as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    db = new FakeDb();
    db.wallets.push({ id: 'w1', userId: 'user-1', status: 'ACTIVE', balance: D(500), totalCredited: D(500), totalDebited: D(0) });
    ledger = new WalletLedgerRepository(db.prisma as unknown as PrismaService);
  });

  it('debits the balance and records balance before and after', async () => {
    const { transaction, replayed } = await ledger.post(tx(), entry());
    assert.equal(replayed, false);
    assert.equal(transaction.direction, 'DEBIT');
    assert.equal(transaction.amount.toString(), '100');
    assert.equal(transaction.balanceBefore.toString(), '500');
    assert.equal(transaction.balanceAfter.toString(), '400');
    assert.equal(db.wallets[0].balance.toString(), '400');
    assert.equal(db.wallets[0].totalDebited.toString(), '100');
  });

  it('credits the balance and the credited total', async () => {
    const { transaction } = await ledger.post(tx(), entry({ type: 'GAME_WINNING_CREDIT', amount: 250.5, idempotencyKey: 'key-0002' }));
    assert.equal(transaction.direction, 'CREDIT');
    assert.equal(transaction.balanceBefore.toString(), '500');
    assert.equal(transaction.balanceAfter.toString(), '750.5');
    assert.equal(db.wallets[0].totalCredited.toString(), '750.5');
  });

  it('refuses a debit larger than the balance and changes nothing', async () => {
    await assert.rejects(ledger.post(tx(), entry({ amount: 500.01 })), InsufficientBalanceError);
    assert.equal(db.wallets[0].balance.toString(), '500');
    assert.equal(db.transactions.length, 0);
  });

  it('allows spending exactly the whole balance, never below zero', async () => {
    const { transaction } = await ledger.post(tx(), entry({ amount: 500 }));
    assert.equal(transaction.balanceAfter.toString(), '0');
    await assert.rejects(ledger.post(tx(), entry({ amount: 0.01, idempotencyKey: 'key-0002' })), InsufficientBalanceError);
    assert.equal(db.wallets[0].balance.toString(), '0');
  });

  it('refuses credits and debits on a suspended wallet', async () => {
    db.wallets[0].status = 'SUSPENDED';
    await assert.rejects(ledger.post(tx(), entry()), WalletSuspendedError);
    await assert.rejects(
      ledger.post(tx(), entry({ type: 'ADMIN_CREDIT', idempotencyKey: 'key-0002' })),
      WalletSuspendedError,
    );
    assert.equal(db.wallets[0].balance.toString(), '500');
  });

  it('refuses a user without a wallet', async () => {
    await assert.rejects(ledger.post(tx(), entry({ userId: 'nobody' })), WalletNotFoundError);
  });

  it('rejects zero, negative, non-finite and sub-cent amounts', async () => {
    for (const amount of [0, -5, NaN, Infinity, 1.005, 0.001]) {
      await assert.rejects(ledger.post(tx(), entry({ amount })), InvalidAmountError, `amount ${amount}`);
    }
    assert.equal(db.transactions.length, 0);
  });

  describe('idempotency', () => {
    it('returns the original entry and posts nothing for a repeated key', async () => {
      const first = await ledger.post(tx(), entry());
      const second = await ledger.post(tx(), entry());
      assert.equal(second.replayed, true);
      assert.equal(second.transaction.id, first.transaction.id);
      assert.equal(db.transactions.length, 1);
      assert.equal(db.wallets[0].balance.toString(), '400', 'the debit happened once');
    });

    it('refuses a key reused for a different amount, type or user', async () => {
      await ledger.post(tx(), entry());
      await assert.rejects(ledger.post(tx(), entry({ amount: 50 })), IdempotencyConflictError);
      await assert.rejects(ledger.post(tx(), entry({ type: 'ADMIN_DEBIT' })), IdempotencyConflictError);
      await assert.rejects(ledger.post(tx(), entry({ userId: 'user-2' })), IdempotencyConflictError);
      assert.equal(db.wallets[0].balance.toString(), '400');
    });

    it('postAtomically rolls back a failed posting completely', async () => {
      await assert.rejects(ledger.postAtomically(entry({ amount: 999 })), InsufficientBalanceError);
      assert.equal(db.wallets[0].balance.toString(), '500');
      assert.equal(db.transactions.length, 0);
    });

    it('postAtomically treats a lost unique-key race as a replay of the winner', async () => {
      // Another request posted the same key between our "is the key free?" check and our insert.
      const winner = await ledger.post(tx(), entry());
      const realFind = db.tx.walletTransaction.findUnique;
      let hidden = true;
      db.tx.walletTransaction.findUnique = async (args: { where: { idempotencyKey: string } }) =>
        hidden ? null : realFind(args);
      const repo = new WalletLedgerRepository({
        $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
          try {
            return await db.prisma.$transaction(work);
          } finally {
            hidden = false;
          }
        },
        walletTransaction: { findUnique: realFind },
      } as unknown as PrismaService);

      const result = await repo.postAtomically(entry());
      assert.equal(result.replayed, true);
      assert.equal(result.transaction.id, winner.transaction.id);
      assert.equal(db.wallets[0].balance.toString(), '400', 'still only one debit');
    });
  });

  it('keeps balance = totalCredited - totalDebited across a sequence of operations', async () => {
    await ledger.post(tx(), entry({ type: 'ADMIN_CREDIT', amount: 70, idempotencyKey: 'k-a-0001' }));
    await ledger.post(tx(), entry({ amount: 120, idempotencyKey: 'k-b-0001' }));
    await ledger.post(tx(), entry({ type: 'GAME_WINNING_CREDIT', amount: 33.33, idempotencyKey: 'k-c-0001' }));
    await ledger.post(tx(), entry({ type: 'ADMIN_DEBIT', amount: 10.1, idempotencyKey: 'k-d-0001' }));

    const wallet = db.wallets[0];
    assert.equal(wallet.balance.toString(), wallet.totalCredited.minus(wallet.totalDebited).toString());
    // every ledger row is consistent with the one before it
    let running = D(500);
    for (const row of db.transactions) {
      assert.equal(row.balanceBefore.toString(), running.toString());
      running = row.direction === 'CREDIT' ? running.plus(row.amount) : running.minus(row.amount);
      assert.equal(row.balanceAfter.toString(), running.toString());
    }
  });
});
