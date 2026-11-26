import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CoinTransferService } from '../demo-wallet/coin-transfers/coin-transfer.service';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { CreateManagedAccountDto, ListManagedAccountsQueryDto, UpdateManagedAccountDto } from './dto/managed-account.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { HierarchyService } from './hierarchy.service';
import { CreateUserData, SafeUser } from './interfaces/user.interface';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const user = (id: string, role: Role, parentId: string | null = null, extra: Partial<SafeUser> = {}): SafeUser => ({
  id,
  name: id.toUpperCase(),
  email: `${id}@example.com`,
  role,
  isActive: true,
  parentId,
  deletedAt: null,
  createdAt: new Date('2026-11-01'),
  updatedAt: new Date('2026-11-01'),
  ...extra,
});

class FakeUsersRepository {
  users: SafeUser[] = [];
  lastFindMany: Record<string, any> | null = null;
  updates: { id: string; data: Record<string, any> }[] = [];

  async findManaged(id: string, role: Role, parentId?: string) {
    return this.users.find((u) => u.id === id && u.role === role && !u.deletedAt && (!parentId || u.parentId === parentId)) ?? null;
  }
  async findMany(params: Record<string, any>) {
    this.lastFindMany = params;
    const { filter } = params;
    const items = this.users.filter((u) => (!filter.role || u.role === filter.role) && (!filter.parentId || u.parentId === filter.parentId) && !u.deletedAt);
    return { items, total: items.length };
  }
  async update(id: string, data: Record<string, any>) {
    this.updates.push({ id, data });
    const target = this.users.find((u) => u.id === id)!;
    Object.assign(target, Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== undefined && k !== 'passwordHash')));
    return target;
  }
  async existsByEmailExcluding() {
    return false;
  }
  async countClientsByMaster() {
    return new Map();
  }
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
}

describe('HierarchyService', () => {
  let repo: FakeUsersRepository;
  let created: CreateUserData[];
  let reclaims: { master: { id: string }; client: { id: string } }[];
  let txCalls: { userUpdates: any[]; tokenRevokes: any[] };
  let transferFilters: Record<string, any>[];
  let service: HierarchyService;

  const master1 = user('master-1', Role.MASTER);
  const master2 = user('master-2', Role.MASTER);
  const superAdmin = user('super', Role.SUPER_ADMIN);

  beforeEach(() => {
    repo = new FakeUsersRepository();
    repo.users = [superAdmin, master1, master2, user('client-1', Role.CLIENT, 'master-1'), user('client-2', Role.CLIENT, 'master-2')];
    created = [];
    reclaims = [];
    transferFilters = [];
    txCalls = { userUpdates: [], tokenRevokes: [] };

    const usersService = {
      create: async (data: CreateUserData) => {
        created.push(data);
        return user('new-user', data.role ?? Role.USER, data.parentId ?? null, { name: data.name, email: data.email });
      },
    } as unknown as UsersService;
    const passwordService = { hash: async (p: string) => `hashed:${p}` } as unknown as PasswordService;
    const coinTransfers = {
      masterSummary: async () => ({ balance: 0, totalReceived: 0, totalDistributed: 0 }),
      masterSummaries: async () => new Map(),
      balancesOf: async (ids: string[]) => new Map(ids.map((id) => [id, 0])),
      reclaimBalance: async (_tx: unknown, master: { id: string }, client: { id: string }) => {
        reclaims.push({ master, client });
        return { amount: 5000 };
      },
      list: async (filter: Record<string, any>) => {
        transferFilters.push(filter);
        return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      },
    } as unknown as CoinTransferService;
    const prisma = {
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          user: {
            findFirst: async ({ where }: { where: { id: string; parentId: string } }) =>
              repo.users.find((u) => u.id === where.id && u.parentId === where.parentId && !u.deletedAt) ?? null,
            update: async (args: unknown) => txCalls.userUpdates.push(args),
          },
          refreshToken: { updateMany: async (args: unknown) => txCalls.tokenRevokes.push(args) },
        }),
    } as unknown as PrismaService;
    const walletService = { ensureWallet: async () => ({}) } as unknown as DemoWalletService;

    service = new HierarchyService(usersService, repo as unknown as UsersRepository, passwordService, prisma, coinTransfers, walletService);
  });

  const input = (overrides: Partial<CreateManagedAccountDto> = {}) =>
    Object.assign(new CreateManagedAccountDto(), { name: 'New Person', email: 'new@example.com', password: 'Str0ngPassword', ...overrides });

  describe('creating accounts', () => {
    it("creates a CLIENT whose parentId is the authenticated master's id and stores only a password hash", async () => {
      const result = await service.createClient(master1, input());

      assert.equal(created.length, 1);
      assert.equal(created[0].role, Role.CLIENT);
      assert.equal(created[0].parentId, 'master-1');
      assert.equal(created[0].passwordHash, 'hashed:Str0ngPassword');
      assert.ok(!('password' in created[0]));
      assert.equal(result.balance, 0);
    });

    it('ignores a parentId or role smuggled onto the DTO object: the parent always comes from the authenticated master', async () => {
      const sneaky = Object.assign(input(), { parentId: 'master-2', role: Role.SUPER_ADMIN });
      await service.createClient(master1, sneaky);
      assert.equal(created[0].parentId, 'master-1');
      assert.equal(created[0].role, Role.CLIENT);
    });

    it('creates a MASTER with no parent', async () => {
      await service.createMaster(input({ email: 'm@example.com' }));
      assert.equal(created[0].role, Role.MASTER);
      assert.equal(created[0].parentId, undefined);
    });
  });

  describe("a master and another master's clients", () => {
    it('lists only the clients whose parent is the authenticated master', async () => {
      await service.listOwnClients(master1, Object.assign(new ListManagedAccountsQueryDto(), { page: 1, limit: 20 }));
      assert.equal(repo.lastFindMany!.filter.parentId, 'master-1');
      assert.equal(repo.lastFindMany!.filter.role, Role.CLIENT);
    });

    it('reads, updates, activates, deactivates, checks the balance of and views the history of an own client', async () => {
      assert.equal((await service.getOwnClient(master1, 'client-1')).id, 'client-1');
      await service.updateOwnClient(master1, 'client-1', Object.assign(new UpdateManagedAccountDto(), { name: 'Renamed' }));
      await service.setOwnClientActive(master1, 'client-1', false);
      assert.deepEqual(await service.getOwnClientBalance(master1, 'client-1'), { clientId: 'client-1', balance: 0 });
      await service.listOwnClientTransactions(master1, 'client-1', {}, 1, 20);
      assert.equal(repo.updates.length, 2);
    });

    it("answers 404 for every action on another master's client, and changes nothing", async () => {
      const foreign = 'client-2'; // belongs to master-2
      const dto = Object.assign(new UpdateManagedAccountDto(), { name: 'Hacked' });
      await assert.rejects(service.getOwnClient(master1, foreign), NotFoundException);
      await assert.rejects(service.updateOwnClient(master1, foreign, dto), NotFoundException);
      await assert.rejects(service.setOwnClientActive(master1, foreign, false), NotFoundException);
      await assert.rejects(service.getOwnClientBalance(master1, foreign), NotFoundException);
      await assert.rejects(service.listOwnClientTransactions(master1, foreign, {}, 1, 20), NotFoundException);
      await assert.rejects(service.deleteOwnClient(master1, foreign), NotFoundException);

      assert.equal(repo.updates.length, 0);
      assert.equal(txCalls.userUpdates.length, 0);
      assert.equal(reclaims.length, 0);
      assert.equal(transferFilters.length, 0);
    });

    it('a master id (or any non-client) is not found through the client routes', async () => {
      await assert.rejects(service.getOwnClient(master1, 'master-2'), NotFoundException);
      await assert.rejects(service.getOwnClient(master1, 'super'), NotFoundException);
    });

    it('always scopes coin history to the authenticated master, even if the caller passes another masterId', async () => {
      await service.listOwnCoinTransactions(master1, { masterId: 'master-2' } as never, 1, 20);
      await service.listOwnClientTransactions(master1, 'client-1', { masterId: 'master-2' } as never, 1, 20);
      assert.equal(transferFilters[0].masterId, 'master-1');
      assert.equal(transferFilters[1].masterId, 'master-1');
      assert.equal(transferFilters[1].participantId, 'client-1');
    });
  });

  describe('deleting a client', () => {
    it('returns the remaining coins to the master, soft-deletes the account and revokes its sessions in one transaction', async () => {
      const result = await service.deleteOwnClient(master1, 'client-1');

      assert.deepEqual(result, { id: 'client-1', deleted: true, coinsReturned: 5000 });
      assert.deepEqual(reclaims.map((r) => [r.master.id, r.client.id]), [['master-1', 'client-1']]);
      assert.equal(txCalls.userUpdates.length, 1);
      const { where, data } = txCalls.userUpdates[0];
      assert.equal(where.id, 'client-1');
      assert.equal(data.isActive, false);
      assert.ok(data.deletedAt instanceof Date);
      assert.equal(txCalls.tokenRevokes[0].where.userId, 'client-1');
      // the row is never hard-deleted: ledger and history keep pointing at it
      assert.ok(!('delete' in txCalls));
    });
  });

  describe('Super Admin masters', () => {
    it('manages only MASTER accounts: a client or the super admin looks like a missing master', async () => {
      assert.equal((await service.getMaster('master-1')).id, 'master-1');
      await assert.rejects(service.getMaster('client-1'), NotFoundException);
      await assert.rejects(service.getMaster('super'), NotFoundException);
      await assert.rejects(service.setMasterActive('client-1', false), NotFoundException);
      await assert.rejects(service.listClientsOfMaster('client-1', Object.assign(new ListManagedAccountsQueryDto(), { page: 1, limit: 20 })), NotFoundException);
    });

    it("lists a master's clients, and lists masters by role", async () => {
      await service.listClientsOfMaster('master-2', Object.assign(new ListManagedAccountsQueryDto(), { page: 1, limit: 20 }));
      assert.equal(repo.lastFindMany!.filter.parentId, 'master-2');
      await service.listMasters(Object.assign(new ListManagedAccountsQueryDto(), { page: 1, limit: 20 }));
      assert.equal(repo.lastFindMany!.filter.role, Role.MASTER);
    });

    it('activates and deactivates a master', async () => {
      const off = await service.setMasterActive('master-1', false);
      assert.equal(off.isActive, false);
      assert.equal((await service.setMasterActive('master-1', true)).isActive, true);
    });
  });
});

describe('managed-account DTO validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (metatype: new () => object, body: unknown) => pipe.transform(body, { type: 'body', metatype });
  const valid = { name: 'Jane Doe', email: 'Jane@Example.com', password: 'Str0ngPassword' };

  it('accepts a valid account and lower-cases the e-mail', async () => {
    const dto = (await validate(CreateManagedAccountDto, valid)) as CreateManagedAccountDto;
    assert.equal(dto.email, 'jane@example.com');
  });

  it('REJECTS a body that tries to choose its role or parent (parentId is never trusted)', async () => {
    for (const extra of [{ parentId: 'abc' }, { role: 'SUPER_ADMIN' }, { role: 'MASTER' }, { isActive: false }, { balance: 99999 }]) {
      await assert.rejects(validate(CreateManagedAccountDto, { ...valid, ...extra }), BadRequestException, JSON.stringify(extra));
    }
  });

  it('applies the normal password and name rules', async () => {
    for (const password of ['short1', 'allletters', '12345678', undefined]) {
      await assert.rejects(validate(CreateManagedAccountDto, { ...valid, password }), BadRequestException, String(password));
    }
    await assert.rejects(validate(CreateManagedAccountDto, { ...valid, name: 'J' }), BadRequestException);
  });

  it('updates accept only name, email and password', async () => {
    await validate(UpdateManagedAccountDto, { name: 'New Name' });
    await assert.rejects(validate(UpdateManagedAccountDto, { parentId: 'x' }), BadRequestException);
    await assert.rejects(validate(UpdateManagedAccountDto, { role: 'MASTER' }), BadRequestException);
    await assert.rejects(validate(UpdateManagedAccountDto, { name: null }), BadRequestException);
  });

  it('the generic admin endpoint can no longer hand out hierarchy roles', async () => {
    await validate(AdminUpdateUserDto, { role: 'ADMIN' });
    for (const role of ['SUPER_ADMIN', 'MASTER', 'CLIENT']) {
      await assert.rejects(validate(AdminUpdateUserDto, { role }), BadRequestException, role);
    }
  });
});

describe('UsersService protections for the hierarchy', () => {
  const makeService = (users: SafeUser[]) => {
    const repo = {
      findById: async (id: string) => users.find((u) => u.id === id) ?? null,
      existsByEmailExcluding: async () => false,
      update: async (id: string, data: Record<string, unknown>) => ({ ...users.find((u) => u.id === id)!, ...data }),
    };
    return new UsersService(repo as unknown as UsersRepository, {} as unknown as DemoWalletService);
  };
  const admin = user('admin-1', Role.ADMIN);
  const superAdmin = user('super', Role.SUPER_ADMIN);
  const users = [admin, superAdmin, user('master-1', Role.MASTER), user('client-1', Role.CLIENT, 'master-1'), user('player-1', Role.USER)];

  it('a plain ADMIN cannot edit, activate or deactivate a Super Admin', async () => {
    const service = makeService(users);
    await assert.rejects(service.adminUpdate(admin, 'super', Object.assign(new AdminUpdateUserDto(), { name: 'Pwned' })), ForbiddenException);
    await assert.rejects(service.setActive(admin, 'super', false), ForbiddenException);
    await service.setActive(superAdmin, 'master-1', false); // a super admin still can manage others
  });

  it('roles of hierarchy accounts cannot be changed through the admin endpoint', async () => {
    const service = makeService(users);
    for (const id of ['master-1', 'client-1', 'super']) {
      await assert.rejects(service.adminUpdate(superAdmin, id, Object.assign(new AdminUpdateUserDto(), { role: Role.USER })), ForbiddenException, id);
    }
    // ordinary promotion of a player is unchanged
    const promoted = await service.adminUpdate(admin, 'player-1', Object.assign(new AdminUpdateUserDto(), { role: Role.ADMIN }));
    assert.equal(promoted.role, Role.ADMIN);
  });

  it('a deleted account cannot be reactivated or edited through the admin endpoints', async () => {
    const service = makeService([admin, user('gone', Role.CLIENT, 'master-1', { deletedAt: new Date(), isActive: false })]);
    await assert.rejects(service.setActive(admin, 'gone', true), NotFoundException);
    await assert.rejects(service.adminUpdate(admin, 'gone', Object.assign(new AdminUpdateUserDto(), { name: 'Back' })), NotFoundException);
  });
});
