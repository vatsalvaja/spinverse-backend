import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../../common/enums/role.enum';
import { PrismaService } from '../../../database/prisma.service';
import { SafeUser } from '../../users/interfaces/user.interface';
import { DemoWalletService } from '../demo-wallet.service';
import { D, FakeDb } from '../fake-wallet-db.test';
import { WalletLedgerRepository } from '../wallet-ledger.repository';
import { CoinTransferType } from './coin-transfer.constants';
import { AllocateCoinsDto } from './coin-transfer.dto';
import { CoinTransferRepository, TransferParty } from './coin-transfer.repository';
import { CoinTransferService } from './coin-transfer.service';

const party = (id: string, role: Role, extra: Partial<TransferParty> = {}): TransferParty => ({
  id,
  name: id.toUpperCase(),
  email: `${id}@example.com`,
  role,
  isActive: true,
  parentId: null,
  deletedAt: null,
  ...extra,
});
const actorOf = (p: TransferParty) => ({ id: p.id, name: p.name, role: p.role }) as unknown as SafeUser;
const dto = (amount: number, idempotencyKey = `key-${Math.random().toString(36).slice(2)}-00`, note?: string) =>
  Object.assign(new AllocateCoinsDto(), { amount, idempotencyKey, note });

/** In-memory stand-in for CoinTransferRepository (the wallet ledger itself is the real code, on the shared FakeDb). */
class FakeCoinRepo {
  users = new Map<string, TransferParty>();
  rows: Record<string, any>[] = [];
  failCreate = false;
  constructor(private readonly fake: FakeDb) {}

  /** The transaction client used outside a transaction (the service passes it back to the methods below). */
  get db() {
    return this.fake.tx;
  }
  async findParty(_db: unknown, id: string) {
    return this.users.get(id) ?? null;
  }
  async lockWallets() {}
  async findWallet(_db: unknown, userId: string) {
    return this.fake.wallets.find((w) => w.userId === userId) ?? null;
  }
  async findByKey(key: string) {
    return this.rows.find((r) => r.idempotencyKey === key) ?? null;
  }
  async create(_db: unknown, data: Record<string, any>) {
    if (this.failCreate) throw new Error('disk full');
    if (this.rows.some((r) => r.idempotencyKey === data.idempotencyKey)) {
      throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
    }
    const row = {
      id: `ct-${this.rows.length + 1}`,
      ...data,
      amount: D(String(data.amount)),
      senderBalanceAfter: data.senderBalanceAfter ?? null,
      sender: this.users.get(data.senderId),
      receiver: this.users.get(data.receiverId),
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }
}

describe('CoinTransferService (Super Admin -> Master -> Client)', () => {
  let db: FakeDb;
  let repo: FakeCoinRepo;
  let service: CoinTransferService;

  const superAdmin = party('super', Role.SUPER_ADMIN);
  const master1 = party('master-1', Role.MASTER);
  const master2 = party('master-2', Role.MASTER);
  const client1 = party('client-1', Role.CLIENT, { parentId: 'master-1' });
  const client2 = party('client-2', Role.CLIENT, { parentId: 'master-1' });
  const clientOfMaster2 = party('client-3', Role.CLIENT, { parentId: 'master-2' });

  const balance = (userId: string) => db.wallets.find((w) => w.userId === userId)?.balance.toNumber() ?? 0;

  beforeEach(() => {
    db = new FakeDb();
    repo = new FakeCoinRepo(db);
    for (const p of [superAdmin, master1, master2, client1, client2, clientOfMaster2]) repo.users.set(p.id, p);

    const walletService = {
      // hierarchy wallets start empty: no initial credits
      ensureWallet: async (userId: string) => {
        let wallet = db.wallets.find((w) => w.userId === userId);
        if (!wallet) {
          wallet = { id: `w-${userId}`, userId, status: 'ACTIVE', balance: D(0), totalCredited: D(0), totalDebited: D(0) };
          db.wallets.push(wallet);
        }
        return wallet;
      },
    } as unknown as DemoWalletService;

    const prisma = {
      // like the real thing: if the work fails, wallets, ledger AND transfer rows all roll back
      $transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
        const rows = [...repo.rows];
        try {
          return await db.prisma.$transaction(work);
        } catch (error) {
          repo.rows = rows;
          throw error;
        }
      },
    } as unknown as PrismaService;

    service = new CoinTransferService(
      prisma,
      repo as unknown as CoinTransferRepository,
      new WalletLedgerRepository(db.prisma as never),
      walletService,
    );
  });

  describe('Super Admin -> Master', () => {
    it('issues coins: the master gets exactly the amount, with a ledger entry and a transfer that has no sender balance', async () => {
      const { transfer, replayed } = await service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(20000, 'alloc-0001-aaaa', 'Opening allocation'));

      assert.equal(replayed, false);
      assert.equal(balance('master-1'), 20000);
      assert.equal(transfer.type, CoinTransferType.MASTER_ALLOCATION);
      assert.equal(transfer.amount, 20000);
      assert.equal(transfer.senderBalanceAfter, null);
      assert.equal(transfer.receiverBalanceAfter, 20000);
      assert.equal(transfer.senderTransactionId, null);
      assert.equal(transfer.masterId, 'master-1');
      assert.equal(transfer.note, 'Opening allocation');
      assert.deepEqual(
        db.transactions.map((t) => [t.userId, t.type, t.direction, t.amount.toNumber()]),
        [['master-1', 'COIN_ALLOCATION_CREDIT', 'CREDIT', 20000]],
      );
      assert.equal(transfer.receiverTransactionId, db.transactions[0].id);
    });

    it('only a SUPER_ADMIN can issue coins (a master, a client or an admin cannot, even for themselves)', async () => {
      for (const actor of [master1, client1, party('admin-1', Role.ADMIN)]) {
        repo.users.set(actor.id, actor);
        await assert.rejects(service.allocateToMaster(actorOf(actor), 'master-1', dto(100)), ForbiddenException, actor.role);
      }
      assert.equal(balance('master-1'), 0);
      assert.equal(repo.rows.length, 0);
    });

    it('rejects a target that is not a master (404), a deactivated master (409) and a deactivated super admin (403)', async () => {
      await assert.rejects(service.allocateToMaster(actorOf(superAdmin), 'client-1', dto(100)), NotFoundException);
      await assert.rejects(service.allocateToMaster(actorOf(superAdmin), 'ghost', dto(100)), NotFoundException);
      repo.users.set('master-1', { ...master1, isActive: false });
      await assert.rejects(service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(100)), ConflictException);
      repo.users.set('master-1', master1);
      repo.users.set('super', { ...superAdmin, isActive: false });
      await assert.rejects(service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(100)), ForbiddenException);
      assert.equal(db.transactions.length, 0);
    });
  });

  describe('Master -> Client', () => {
    beforeEach(async () => {
      await service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(20000, 'seed-0001-aaaa'));
    });

    it('follows the example: 20,000 in, 5,000 to client 1, 3,000 to client 2, 12,000 left', async () => {
      const first = await service.allocateToClient(actorOf(master1), 'client-1', dto(5000));
      const second = await service.allocateToClient(actorOf(master1), 'client-2', dto(3000));

      assert.equal(balance('master-1'), 12000);
      assert.equal(balance('client-1'), 5000);
      assert.equal(balance('client-2'), 3000);

      assert.equal(first.transfer.type, CoinTransferType.CLIENT_ALLOCATION);
      assert.equal(first.transfer.senderBalanceAfter, 15000);
      assert.equal(first.transfer.receiverBalanceAfter, 5000);
      assert.equal(second.transfer.senderBalanceAfter, 12000);
      assert.equal(second.transfer.masterId, 'master-1');
      assert.ok(first.transfer.senderTransactionId && first.transfer.receiverTransactionId);

      // coins are conserved: nothing was created or lost between master and clients
      assert.equal(balance('master-1') + balance('client-1') + balance('client-2'), 20000);
      const debit = db.transactions.find((t) => t.id === first.transfer.senderTransactionId)!;
      assert.equal(debit.type, 'COIN_ALLOCATION_DEBIT');
      assert.equal(debit.userId, 'master-1');
      assert.equal(db.transactions.find((t) => t.id === first.transfer.receiverTransactionId)!.type, 'COIN_ALLOCATION_CREDIT');
    });

    it('refuses to allocate more than the available balance, leaving every balance and the history untouched', async () => {
      await service.allocateToClient(actorOf(master1), 'client-1', dto(5000));
      await service.allocateToClient(actorOf(master1), 'client-2', dto(3000));
      const ledgerSize = db.transactions.length;
      const rows = repo.rows.length;

      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(12000.01)), ConflictException);
      assert.equal(balance('master-1'), 12000);
      assert.equal(balance('client-1'), 5000);
      assert.equal(db.transactions.length, ledgerSize);
      assert.equal(repo.rows.length, rows);

      // spending exactly what is left is fine, and the balance lands on zero (never negative)
      await service.allocateToClient(actorOf(master1), 'client-1', dto(12000));
      assert.equal(balance('master-1'), 0);
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-2', dto(0.01)), ConflictException);
      assert.equal(balance('master-1'), 0);
    });

    it("a master cannot reach another master's client: it looks like the client does not exist (404) and nothing moves", async () => {
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-3', dto(100)), NotFoundException);
      await assert.rejects(service.allocateToClient(actorOf(master2), 'client-1', dto(100)), NotFoundException);
      assert.equal(balance('master-1'), 20000);
      assert.equal(balance('client-3'), 0);
      assert.equal(repo.rows.length, 1); // only the seed allocation
    });

    it('only a MASTER can allocate to clients: not a client, an admin or the super admin', async () => {
      for (const actor of [client1, superAdmin, party('admin-1', Role.ADMIN)]) {
        repo.users.set(actor.id, actor);
        await assert.rejects(service.allocateToClient(actorOf(actor), 'client-1', dto(100)), ForbiddenException, actor.role);
      }
      assert.equal(balance('client-1'), 0);
    });

    it('refuses a deactivated or deleted client, and a deactivated master', async () => {
      repo.users.set('client-1', { ...client1, isActive: false });
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(100)), ConflictException);
      repo.users.set('client-1', { ...client1, deletedAt: new Date() });
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(100)), NotFoundException);
      repo.users.set('client-1', client1);
      repo.users.set('master-1', { ...master1, isActive: false });
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(100)), ForbiddenException);
      assert.equal(balance('master-1'), 20000);
    });

    it('is atomic: if the transfer record cannot be written, the wallet changes and ledger entries roll back too', async () => {
      repo.failCreate = true;
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(5000)), /disk full/);
      assert.equal(balance('master-1'), 20000);
      assert.equal(balance('client-1'), 0);
      assert.equal(db.transactions.length, 1); // just the seed credit
      assert.equal(repo.rows.length, 1);
    });
  });

  describe('idempotency', () => {
    beforeEach(async () => {
      await service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(20000, 'seed-0001-aaaa'));
    });

    it('repeating a key returns the original transfer and never allocates twice', async () => {
      const first = await service.allocateToClient(actorOf(master1), 'client-1', dto(5000, 'retry-key-0001'));
      const again = await service.allocateToClient(actorOf(master1), 'client-1', dto(5000, 'retry-key-0001'));

      assert.equal(first.replayed, false);
      assert.equal(again.replayed, true);
      assert.equal(again.transfer.id, first.transfer.id);
      assert.equal(balance('master-1'), 15000);
      assert.equal(balance('client-1'), 5000);
      assert.equal(repo.rows.length, 2);
    });

    it('reusing a key for a different amount is a conflict, not a second allocation', async () => {
      await service.allocateToClient(actorOf(master1), 'client-1', dto(5000, 'retry-key-0002'));
      await assert.rejects(service.allocateToClient(actorOf(master1), 'client-1', dto(6000, 'retry-key-0002')), ConflictException);
      assert.equal(balance('client-1'), 5000);
    });

    it('keys are scoped to sender and receiver: the same key text for another client is a new allocation', async () => {
      await service.allocateToClient(actorOf(master1), 'client-1', dto(1000, 'shared-key-0001'));
      const other = await service.allocateToClient(actorOf(master1), 'client-2', dto(1000, 'shared-key-0001'));
      assert.equal(other.replayed, false);
      assert.equal(balance('client-2'), 1000);
    });

    it('a request that loses a race on the key gets the winner back instead of an error', async () => {
      const winner = await service.allocateToClient(actorOf(master1), 'client-1', dto(1000, 'race-key-00001'));
      // simulate the race: the pre-check does not see the row yet, the insert hits the unique key
      const original = repo.findByKey.bind(repo);
      let calls = 0;
      repo.findByKey = async (key: string) => (calls++ === 0 ? null : original(key));
      const loser = await service.allocateToClient(actorOf(master1), 'client-1', dto(1000, 'race-key-00001'));
      assert.equal(loser.replayed, true);
      assert.equal(loser.transfer.id, winner.transfer.id);
      assert.equal(balance('client-1'), 1000);
    });
  });

  describe('reclaiming a deleted client balance', () => {
    beforeEach(async () => {
      await service.allocateToMaster(actorOf(superAdmin), 'master-1', dto(20000, 'seed-0001-aaaa'));
      await service.allocateToClient(actorOf(master1), 'client-1', dto(5000));
    });

    it('moves what is left back to the master as a CLIENT_RECLAIM transfer', async () => {
      const transfer = await service.reclaimBalance(db.tx as never, { id: 'master-1', name: 'MASTER-1' }, { id: 'client-1', name: 'CLIENT-1' });
      assert.ok(transfer);
      assert.equal(transfer.type, CoinTransferType.CLIENT_RECLAIM);
      assert.equal(transfer.amount, 5000);
      assert.equal(transfer.sender.id, 'client-1');
      assert.equal(transfer.receiver.id, 'master-1');
      assert.equal(balance('client-1'), 0);
      assert.equal(balance('master-1'), 20000);
    });

    it('does nothing for an empty wallet', async () => {
      assert.equal(await service.reclaimBalance(db.tx as never, { id: 'master-1', name: 'M' }, { id: 'client-2', name: 'C2' }), null);
      assert.equal(repo.rows.length, 2);
    });
  });
});

describe('AllocateCoinsDto validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: AllocateCoinsDto });
  const valid = { amount: 5000, idempotencyKey: 'alloc-2026-0001' };

  it('accepts a valid allocation', async () => {
    const parsed = (await validate({ ...valid, note: '  Weekly top-up ' })) as AllocateCoinsDto;
    assert.equal(parsed.amount, 5000);
    assert.equal(parsed.note, 'Weekly top-up');
  });

  it('rejects zero, negative, too precise, too large and non-numeric amounts', async () => {
    for (const amount of [0, -5, 0.001, 1.234, 1_000_000_000.01, '5000', null, undefined]) {
      await assert.rejects(validate({ ...valid, amount }), BadRequestException, `amount ${String(amount)}`);
    }
  });

  it('requires a well-formed idempotency key', async () => {
    for (const idempotencyKey of [undefined, '', 'short', 'has spaces in it', 'x'.repeat(101)]) {
      await assert.rejects(validate({ ...valid, idempotencyKey }), BadRequestException, `key ${String(idempotencyKey)}`);
    }
  });

  it('does not let a request choose the sender, receiver, master, balances or ledger fields', async () => {
    for (const extra of [{ senderId: 'x' }, { receiverId: 'x' }, { masterId: 'x' }, { parentId: 'x' }, { balance: 1 }, { type: 'CLIENT_RECLAIM' }]) {
      await assert.rejects(validate({ ...valid, ...extra }), BadRequestException, JSON.stringify(extra));
    }
  });
});
