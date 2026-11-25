import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { DemoWallet, Prisma, WalletTransaction } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { SafeUser } from '../users/interfaces/user.interface';
import { AdminWalletService } from './admin-wallet.service';
import { DemoWalletRepository } from './demo-wallet.repository';
import { DemoWalletService } from './demo-wallet.service';
import { CreditWalletDto, DebitWalletDto } from './dto/wallet-adjustment.dto';
import { LedgerEntry, PostedEntry } from './interfaces/demo-wallet.interface';
import { WalletLedgerRepository } from './wallet-ledger.repository';
import { InsufficientBalanceError, WalletNotEligibleError } from './wallet.errors';

const D = (value: string | number) => new Prisma.Decimal(value);

const makeWallet = (overrides: Partial<DemoWallet> = {}): DemoWallet => ({
  id: 'w1',
  userId: 'user-1',
  balance: D(5000),
  totalCredited: D(5000),
  totalDebited: D(0),
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeTransaction = (entry: LedgerEntry, overrides: Partial<WalletTransaction> = {}): WalletTransaction => ({
  id: 'tx-1',
  walletId: 'w1',
  userId: entry.userId,
  type: entry.type,
  direction: entry.type.endsWith('DEBIT') ? 'DEBIT' : 'CREDIT',
  amount: D(entry.amount),
  balanceBefore: D(1000),
  balanceAfter: D(1000 + entry.amount),
  gameId: entry.gameId ?? null,
  sessionId: entry.sessionId ?? null,
  roundId: entry.roundId ?? null,
  description: entry.description,
  idempotencyKey: entry.idempotencyKey,
  actorId: entry.actorId ?? null,
  createdAt: new Date(),
  ...overrides,
});

class FakeWallets {
  wallet: DemoWallet | null = null;
  created = 0;
  createError: unknown = null;

  async findByUserId() {
    return this.wallet;
  }
  async createWithInitialCredit(userId: string, startingBalance: number) {
    this.created++;
    if (this.createError) {
      const error = this.createError;
      this.createError = null;
      throw error;
    }
    this.wallet = makeWallet({ userId, balance: D(startingBalance) });
    return this.wallet;
  }
}

class FakeLedger {
  posted: LedgerEntry[] = [];
  roundEntries: WalletTransaction[] = [];
  failWith: unknown = null;
  replay = false;

  async postAtomically(entry: LedgerEntry): Promise<PostedEntry> {
    if (this.failWith) throw this.failWith;
    this.posted.push(entry);
    return { transaction: makeTransaction(entry), replayed: this.replay };
  }
  async findByRound() {
    return this.roundEntries;
  }
  async findMany() {
    return { items: [], total: 0 };
  }
}

const admin: SafeUser = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  role: Role.ADMIN,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DemoWalletService', () => {
  let wallets: FakeWallets;
  let ledger: FakeLedger;
  let service: DemoWalletService;

  beforeEach(() => {
    wallets = new FakeWallets();
    ledger = new FakeLedger();
    service = new DemoWalletService(
      wallets as unknown as DemoWalletRepository,
      ledger as unknown as WalletLedgerRepository,
    );
  });

  describe('ensureWallet', () => {
    it('creates one wallet with the starting credits on first use, then reuses it', async () => {
      const first = await service.ensureWallet('user-1');
      const second = await service.ensureWallet('user-1');
      assert.equal(first.balance.toString(), '5000');
      assert.equal(second.id, first.id);
      assert.equal(wallets.created, 1, 'no duplicate wallet');
    });

    it('uses the wallet another request created first (unique user race)', async () => {
      wallets.createError = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
      // the competing request's wallet appears right after our failed attempt
      const original = wallets.findByUserId.bind(wallets);
      let lookups = 0;
      wallets.findByUserId = async () => (lookups++ === 0 ? null : makeWallet({ id: 'winner' }));
      const wallet = await service.ensureWallet('user-1');
      assert.equal(wallet.id, 'winner');
      void original;
    });

    it('refuses inactive and unknown accounts', async () => {
      wallets.createError = new WalletNotEligibleError('inactive');
      await assert.rejects(service.ensureWallet('user-1'), ForbiddenException);
      wallets.createError = new WalletNotEligibleError('not_found');
      await assert.rejects(service.ensureWallet('user-1'), NotFoundException);
    });
  });

  describe('credit / debit', () => {
    const base = { userId: 'user-1', amount: 10, idempotencyKey: 'key-00001', description: 'x' };

    it('only accepts credit types for credit() and debit types for debit()', async () => {
      await assert.rejects(service.credit({ ...base, type: 'ADMIN_DEBIT' }), BadRequestException);
      await assert.rejects(service.credit({ ...base, type: 'GAME_ENTRY_DEBIT' }), BadRequestException);
      await assert.rejects(service.debit({ ...base, type: 'ADMIN_CREDIT' }), BadRequestException);
      await assert.rejects(service.debit({ ...base, type: 'GAME_WINNING_CREDIT' }), BadRequestException);
      assert.equal(ledger.posted.length, 0);
    });

    it('posts through the ledger with the given idempotency key', async () => {
      await service.credit({ ...base, type: 'BONUS_CREDIT' });
      await service.debit({ ...base, idempotencyKey: 'key-00002', type: 'GAME_ENTRY_DEBIT' });
      assert.deepEqual(ledger.posted.map((p) => [p.type, p.idempotencyKey]), [
        ['BONUS_CREDIT', 'key-00001'],
        ['GAME_ENTRY_DEBIT', 'key-00002'],
      ]);
    });

    it('turns an insufficient balance into 409', async () => {
      ledger.failWith = new InsufficientBalanceError();
      await assert.rejects(service.debit({ ...base, type: 'ADMIN_DEBIT' }), ConflictException);
    });
  });

  describe('refundGameEntry', () => {
    const entryRow = makeTransaction(
      { userId: 'user-1', type: 'GAME_ENTRY_DEBIT', amount: 50, idempotencyKey: 'round:r1:entry', description: 'e', roundId: 'r1', gameId: 'g1', sessionId: 's1' },
    );

    it('refunds exactly the entry once, keyed by the round', async () => {
      ledger.roundEntries = [entryRow];
      await service.refundGameEntry({ roundId: 'r1', reason: 'Round failed' });
      assert.equal(ledger.posted.length, 1);
      assert.equal(ledger.posted[0].type, 'GAME_REFUND');
      assert.equal(ledger.posted[0].amount, 50);
      assert.equal(ledger.posted[0].idempotencyKey, 'round:r1:refund');
      assert.equal(ledger.posted[0].roundId, 'r1');
    });

    it('refuses when the round has no entry charge', async () => {
      ledger.roundEntries = [];
      await assert.rejects(service.refundGameEntry({ roundId: 'r1', reason: 'x' }), NotFoundException);
    });

    it('refuses when the round already paid winnings (no double payment)', async () => {
      ledger.roundEntries = [
        entryRow,
        makeTransaction({ userId: 'user-1', type: 'GAME_WINNING_CREDIT', amount: 100, idempotencyKey: 'round:r1:win:0', description: 'w', roundId: 'r1' }),
      ];
      await assert.rejects(service.refundGameEntry({ roundId: 'r1', reason: 'x' }), ConflictException);
      assert.equal(ledger.posted.length, 0);
    });
  });

  it('rejects an inverted date range in the transaction history', async () => {
    wallets.wallet = makeWallet();
    const query = Object.assign(new (class {})(), {
      page: 1,
      limit: 20,
      from: new Date('2026-12-01'),
      to: new Date('2026-11-01'),
    });
    await assert.rejects(service.listTransactions('user-1', query as never), BadRequestException);
  });
});

describe('AdminWalletService', () => {
  let ledger: FakeLedger;
  let service: AdminWalletService;
  let walletService: DemoWalletService;

  beforeEach(() => {
    const wallets = new FakeWallets();
    wallets.wallet = makeWallet({ userId: 'player-1' });
    ledger = new FakeLedger();
    walletService = new DemoWalletService(
      wallets as unknown as DemoWalletRepository,
      ledger as unknown as WalletLedgerRepository,
    );
    service = new AdminWalletService(
      wallets as unknown as DemoWalletRepository,
      ledger as unknown as WalletLedgerRepository,
      walletService,
    );
  });

  const dto = (overrides: Partial<CreditWalletDto> = {}): CreditWalletDto =>
    Object.assign(new CreditWalletDto(), { amount: 100, reason: 'Support goodwill credit', ...overrides });

  it('records the reason and the acting administrator on a credit', async () => {
    const result = await service.credit(admin, 'player-1', dto());
    const [posted] = ledger.posted;
    assert.equal(posted.type, 'ADMIN_CREDIT');
    assert.equal(posted.description, 'Support goodwill credit');
    assert.equal(posted.actorId, 'admin-1');
    assert.equal(posted.amount, 100);
    assert.equal(result.transaction.actorId, 'admin-1');
    assert.equal(result.replayed, false);
  });

  it('allows BONUS_CREDIT as an admin credit type and ADMIN_DEBIT for debits', async () => {
    await service.credit(admin, 'player-1', dto({ type: 'BONUS_CREDIT' }));
    await service.debit(admin, 'player-1', Object.assign(new DebitWalletDto(), { amount: 5, reason: 'Fix a mistake' }));
    assert.deepEqual(ledger.posted.map((p) => p.type), ['BONUS_CREDIT', 'ADMIN_DEBIT']);
  });

  it('forbids administrators from adjusting their own wallet', async () => {
    await assert.rejects(service.credit(admin, 'admin-1', dto()), ForbiddenException);
    await assert.rejects(service.debit(admin, 'admin-1', dto()), ForbiddenException);
    assert.equal(ledger.posted.length, 0);
  });

  it('namespaces a supplied idempotency key by administrator and player', async () => {
    await service.credit(admin, 'player-1', dto({ idempotencyKey: 'adj-2026-0001' }));
    assert.equal(ledger.posted[0].idempotencyKey, 'admin:admin-1:player-1:adj-2026-0001');
  });

  it('uses a fresh key per call when none is supplied (no accidental de-duplication)', async () => {
    await service.credit(admin, 'player-1', dto());
    await service.credit(admin, 'player-1', dto());
    assert.notEqual(ledger.posted[0].idempotencyKey, ledger.posted[1].idempotencyKey);
  });

  it('reports a replayed operation', async () => {
    ledger.replay = true;
    const result = await service.credit(admin, 'player-1', dto({ idempotencyKey: 'adj-2026-0001' }));
    assert.equal(result.replayed, true);
  });

  it('rejects an inverted date range', async () => {
    const query = { page: 1, limit: 20, from: new Date('2026-12-01'), to: new Date('2026-11-01') };
    await assert.rejects(service.listTransactions(query as never), BadRequestException);
    await assert.rejects(Promise.resolve().then(() => service.getStats(query as never)), BadRequestException);
  });
});

describe('Admin adjustment validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (metatype: new () => object, body: unknown) => pipe.transform(body, { type: 'body', metatype });
  const valid = { amount: 100, reason: 'Support goodwill credit' };

  it('accepts a valid credit and trims the reason', async () => {
    const dto = (await validate(CreditWalletDto, { ...valid, reason: '  Support goodwill credit  ' })) as CreditWalletDto;
    assert.equal(dto.reason, 'Support goodwill credit');
  });

  it('rejects bad amounts: zero, negative, too many decimals, too large, not a number', async () => {
    for (const amount of [0, -1, 1.234, 1_000_000.01, '100', null]) {
      await assert.rejects(validate(CreditWalletDto, { ...valid, amount }), BadRequestException, `amount ${String(amount)}`);
    }
  });

  it('requires a meaningful reason', async () => {
    for (const reason of [undefined, '', '   ', 'ok', 'x'.repeat(301)]) {
      await assert.rejects(validate(DebitWalletDto, { amount: 5, reason }), BadRequestException, `reason ${String(reason)}`);
    }
  });

  it('rejects malformed idempotency keys and unknown credit types', async () => {
    await assert.rejects(validate(CreditWalletDto, { ...valid, idempotencyKey: 'short' }), BadRequestException);
    await assert.rejects(validate(CreditWalletDto, { ...valid, idempotencyKey: 'has spaces in it' }), BadRequestException);
    await assert.rejects(validate(CreditWalletDto, { ...valid, type: 'GAME_REFUND' }), BadRequestException);
    await assert.rejects(validate(CreditWalletDto, { ...valid, type: 'ADMIN_DEBIT' }), BadRequestException);
  });

  it('does not let a client set balances or ledger fields', async () => {
    await assert.rejects(validate(CreditWalletDto, { ...valid, balance: 999999 }), BadRequestException);
    await assert.rejects(validate(DebitWalletDto, { ...valid, userId: 'someone-else' }), BadRequestException);
  });
});
