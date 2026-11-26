import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NO_FIELDS_TO_UPDATE } from '../../common/constants/validation.constants';
import { Role } from '../../common/enums/role.enum';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { hasDefinedValues } from '../../common/utils/object.util';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { AllocateCoinsDto } from '../demo-wallet/coin-transfers/coin-transfer.dto';
import { CoinAllocationResult, CoinTransferFilter, CoinTransferView } from '../demo-wallet/coin-transfers/coin-transfer.interface';
import { CoinTransferService } from '../demo-wallet/coin-transfers/coin-transfer.service';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { mapWalletError } from '../demo-wallet/wallet.errors';
import { USER_ERRORS } from './constants/users.constants';
import { CreateManagedAccountDto, ListManagedAccountsQueryDto, SuperAdminListUsersQueryDto, UpdateManagedAccountDto } from './dto/managed-account.dto';
import { ClientView, DeleteClientResult, MasterView, SystemOverview } from './interfaces/hierarchy.interface';
import { SafeUser } from './interfaces/user.interface';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * The Super Admin -> Master -> Client hierarchy.
 *
 * Ownership rules, all enforced here from the database and the authenticated user (never from request fields):
 *  - the role of a new account is fixed by the method (`createMaster` makes a MASTER, `createClient` a CLIENT);
 *  - a client's `parentId` is ALWAYS the authenticated master's id;
 *  - every master-side lookup is `WHERE id = :id AND role = CLIENT AND parentId = :master`, so another master's
 *    client is indistinguishable from a client that does not exist (404);
 *  - the Super Admin methods are reachable only through `@Auth(Role.SUPER_ADMIN)` controllers.
 * Coins never move here: allocations go through `CoinTransferService`, on the existing wallet ledger.
 */
@Injectable()
export class HierarchyService {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly coinTransfers: CoinTransferService,
    private readonly walletService: DemoWalletService,
  ) {}

  // ===========================================================================
  // Super Admin -> Masters
  // ===========================================================================

  async createMaster(dto: CreateManagedAccountDto): Promise<MasterView> {
    const master = await this.createAccount(dto, Role.MASTER);
    return this.toMasterView(master);
  }

  async listMasters(query: ListManagedAccountsQueryDto): Promise<PaginatedResult<MasterView>> {
    const { items, total } = await this.usersRepository.findMany({
      filter: { role: Role.MASTER, search: query.search, isActive: query.isActive },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    const ids = items.map((m) => m.id);
    const [summaries, counts] = await Promise.all([this.coinTransfers.masterSummaries(ids), this.usersRepository.countClientsByMaster(ids)]);
    const views = items.map((m) => ({
      ...m,
      wallet: summaries.get(m.id)!,
      clients: counts.get(m.id) ?? { total: 0, active: 0 },
    }));
    return buildPaginatedResult(views, total, query.page, query.limit);
  }

  async getMaster(id: string): Promise<MasterView> {
    return this.toMasterView(await this.getMasterOrFail(id));
  }

  async updateMaster(id: string, dto: UpdateManagedAccountDto): Promise<MasterView> {
    const master = await this.getMasterOrFail(id);
    return this.toMasterView(await this.applyUpdate(master, dto));
  }

  async setMasterActive(id: string, isActive: boolean): Promise<MasterView> {
    const master = await this.getMasterOrFail(id);
    const updated = master.isActive === isActive ? master : await this.usersRepository.update(id, { isActive });
    return this.toMasterView(updated);
  }

  /** A master's clients, for the Super Admin. */
  async listClientsOfMaster(masterId: string, query: ListManagedAccountsQueryDto): Promise<PaginatedResult<ClientView>> {
    await this.getMasterOrFail(masterId);
    return this.listClients(masterId, query);
  }

  async getMasterWallet(masterId: string) {
    await this.getMasterOrFail(masterId);
    return this.masterWallet(masterId);
  }

  allocateToMaster(actor: SafeUser, masterId: string, dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.coinTransfers.allocateToMaster(actor, masterId, dto);
  }

  async listMasterAllocations(masterId: string, filter: CoinTransferFilter, page: number, limit: number): Promise<PaginatedResult<CoinTransferView>> {
    await this.getMasterOrFail(masterId);
    return this.coinTransfers.list({ ...filter, masterId }, page, limit);
  }

  /** Every account in the system (all roles), with its owning master and coin balance. */
  async listAllUsers(query: SuperAdminListUsersQueryDto): Promise<PaginatedResult<ClientView>> {
    const { items, total } = await this.usersRepository.findMany({
      filter: { search: query.search, role: query.role, isActive: query.isActive, parentId: query.parentId },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    const balances = await this.coinTransfers.balancesOf(items.map((u) => u.id));
    return buildPaginatedResult(items.map((u) => ({ ...u, balance: balances.get(u.id) ?? 0 })), total, query.page, query.limit);
  }

  listAllCoinTransactions(filter: CoinTransferFilter, page: number, limit: number): Promise<PaginatedResult<CoinTransferView>> {
    return this.coinTransfers.list(filter, page, limit);
  }

  async getOverview(): Promise<SystemOverview> {
    const [counts, coins] = await Promise.all([this.usersService.getCounts(), this.coinTransfers.systemTotals()]);
    return { users: { total: counts.total, active: counts.active, byRole: counts.byRole }, coins };
  }

  // ===========================================================================
  // Master -> own Clients
  // ===========================================================================

  /** Creates a CLIENT owned by the authenticated master. `parentId` comes from `master.id`, never from the body. */
  async createClient(master: SafeUser, dto: CreateManagedAccountDto): Promise<ClientView> {
    const client = await this.createAccount(dto, Role.CLIENT, master.id);
    return { ...client, balance: 0 };
  }

  async listOwnClients(master: SafeUser, query: ListManagedAccountsQueryDto): Promise<PaginatedResult<ClientView>> {
    return this.listClients(master.id, query);
  }

  async getOwnClient(master: SafeUser, clientId: string): Promise<ClientView> {
    return this.toClientView(await this.getOwnClientOrFail(master, clientId));
  }

  async updateOwnClient(master: SafeUser, clientId: string, dto: UpdateManagedAccountDto): Promise<ClientView> {
    const client = await this.getOwnClientOrFail(master, clientId);
    return this.toClientView(await this.applyUpdate(client, dto));
  }

  async setOwnClientActive(master: SafeUser, clientId: string, isActive: boolean): Promise<ClientView> {
    const client = await this.getOwnClientOrFail(master, clientId);
    const updated = client.isActive === isActive ? client : await this.usersRepository.update(client.id, { isActive });
    return this.toClientView(updated);
  }

  /**
   * Deletes a client safely. The account is soft-deleted (its row stays so the wallet ledger and coin history keep
   * pointing at something real), and everything happens in ONE transaction:
   *   1. whatever the client still holds goes back to the master (a CLIENT_RECLAIM transfer, so no coins vanish),
   *   2. the account is deactivated and marked deleted (it can never sign in again and drops out of every list),
   *   3. its refresh tokens are revoked.
   * The wallet and all ledger and transfer rows are kept untouched.
   */
  async deleteOwnClient(master: SafeUser, clientId: string): Promise<DeleteClientResult> {
    await this.getOwnClientOrFail(master, clientId);
    try {
      await this.walletService.ensureWallet(master.id); // the master wallet must exist to take the coins back
      const reclaimed = await this.prisma.$transaction(async (tx) => {
        // re-check ownership against fresh data inside the transaction
        const client = await tx.user.findFirst({
          where: { id: clientId, role: Role.CLIENT, parentId: master.id, deletedAt: null },
          select: { id: true, name: true },
        });
        if (!client) throw new NotFoundException(USER_ERRORS.CLIENT_NOT_FOUND);

        const returned = await this.coinTransfers.reclaimBalance(tx, { id: master.id, name: master.name }, client);
        const now = new Date();
        await tx.user.update({ where: { id: client.id }, data: { isActive: false, deletedAt: now } });
        await tx.refreshToken.updateMany({ where: { userId: client.id, revokedAt: null }, data: { revokedAt: now } });
        return returned;
      });
      return { id: clientId, deleted: true, coinsReturned: reclaimed?.amount ?? 0 };
    } catch (error) {
      throw mapWalletError(error) ?? error;
    }
  }

  allocateToOwnClient(master: SafeUser, clientId: string, dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.coinTransfers.allocateToClient(master, clientId, dto);
  }

  async getOwnClientBalance(master: SafeUser, clientId: string): Promise<{ clientId: string; balance: number }> {
    const client = await this.getOwnClientOrFail(master, clientId);
    const balances = await this.coinTransfers.balancesOf([client.id]);
    return { clientId: client.id, balance: balances.get(client.id) ?? 0 };
  }

  /** Coin transfers of one of the master's own clients. Scoped to the master twice (ownership and `masterId`). */
  async listOwnClientTransactions(master: SafeUser, clientId: string, filter: CoinTransferFilter, page: number, limit: number): Promise<PaginatedResult<CoinTransferView>> {
    const client = await this.getOwnClientOrFail(master, clientId);
    return this.coinTransfers.list({ ...filter, masterId: master.id, participantId: client.id }, page, limit);
  }

  /** Everything the master is part of: coins received, allocations to clients and coins returned. Never another master's. */
  listOwnCoinTransactions(master: SafeUser, filter: CoinTransferFilter, page: number, limit: number): Promise<PaginatedResult<CoinTransferView>> {
    return this.coinTransfers.list({ ...filter, masterId: master.id }, page, limit);
  }

  async getOwnWallet(master: SafeUser) {
    return this.masterWallet(master.id);
  }

  // ===========================================================================
  // Shared
  // ===========================================================================

  private async createAccount(dto: CreateManagedAccountDto, role: Role, parentId?: string): Promise<SafeUser> {
    const passwordHash = await this.passwordService.hash(dto.password);
    return this.usersService.create({ name: dto.name, email: dto.email, passwordHash, role, parentId });
  }

  private async applyUpdate(target: SafeUser, dto: UpdateManagedAccountDto): Promise<SafeUser> {
    if (!hasDefinedValues(dto)) throw new BadRequestException(NO_FIELDS_TO_UPDATE);
    if (dto.email !== undefined && dto.email !== target.email && (await this.usersRepository.existsByEmailExcluding(dto.email, target.id))) {
      throw new ConflictException(USER_ERRORS.EMAIL_TAKEN);
    }
    return this.usersRepository.update(target.id, {
      name: dto.name,
      email: dto.email,
      passwordHash: dto.password === undefined ? undefined : await this.passwordService.hash(dto.password),
    });
  }

  private async listClients(masterId: string, query: ListManagedAccountsQueryDto): Promise<PaginatedResult<ClientView>> {
    const { items, total } = await this.usersRepository.findMany({
      filter: { role: Role.CLIENT, parentId: masterId, search: query.search, isActive: query.isActive },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    const balances = await this.coinTransfers.balancesOf(items.map((c) => c.id));
    return buildPaginatedResult(items.map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 })), total, query.page, query.limit);
  }

  private async masterWallet(masterId: string) {
    const [summary, counts] = await Promise.all([this.coinTransfers.masterSummary(masterId), this.usersRepository.countClientsByMaster([masterId])]);
    return { masterId, ...summary, clients: counts.get(masterId) ?? { total: 0, active: 0 } };
  }

  private async getMasterOrFail(id: string): Promise<SafeUser> {
    const master = await this.usersRepository.findManaged(id, Role.MASTER);
    if (!master) throw new NotFoundException(USER_ERRORS.MASTER_NOT_FOUND);
    return master;
  }

  private async getOwnClientOrFail(master: SafeUser, clientId: string): Promise<SafeUser> {
    const client = await this.usersRepository.findManaged(clientId, Role.CLIENT, master.id);
    if (!client) throw new NotFoundException(USER_ERRORS.CLIENT_NOT_FOUND);
    return client;
  }

  private async toMasterView(master: SafeUser): Promise<MasterView> {
    const [wallet, counts] = await Promise.all([this.coinTransfers.masterSummary(master.id), this.usersRepository.countClientsByMaster([master.id])]);
    return { ...master, wallet, clients: counts.get(master.id) ?? { total: 0, active: 0 } };
  }

  private async toClientView(client: SafeUser): Promise<ClientView> {
    const balances = await this.coinTransfers.balancesOf([client.id]);
    return { ...client, balance: balances.get(client.id) ?? 0 };
  }
}
