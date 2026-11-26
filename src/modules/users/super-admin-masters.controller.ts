import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { Audit } from '../audit/decorators/audit.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { COIN_MESSAGES } from '../demo-wallet/coin-transfers/coin-transfer.constants';
import {
  AdminListCoinTransfersQueryDto,
  AllocateCoinsDto,
  CoinAllocationResponseDto,
  CoinTransferResponseDto,
  ListCoinTransfersQueryDto,
} from '../demo-wallet/coin-transfers/coin-transfer.dto';
import type { CoinAllocationResult, CoinTransferView } from '../demo-wallet/coin-transfers/coin-transfer.interface';
import { HierarchyService } from './hierarchy.service';
import { HIERARCHY_MESSAGES, SUPER_ADMIN_API_TAG, SUPER_ADMIN_ROUTE } from './constants/hierarchy.constants';
import { CreateManagedAccountDto, ListManagedAccountsQueryDto, SuperAdminListUsersQueryDto, UpdateManagedAccountDto } from './dto/managed-account.dto';
import {
  ClientResponseDto,
  MasterResponseDto,
  MasterWalletResponseDto,
  SystemOverviewResponseDto,
} from './dto/managed-account-response.dto';
import type { ClientView, MasterView, SystemOverview } from './interfaces/hierarchy.interface';
import type { SafeUser } from './interfaces/user.interface';

/**
 * Super Admin: creates and manages Masters, issues coins to them and sees the whole system.
 * Every route requires the SUPER_ADMIN role: a Master, a Client or a plain ADMIN gets 403.
 */
@ApiTags(SUPER_ADMIN_API_TAG)
@Controller(SUPER_ADMIN_ROUTE)
@Auth(Role.SUPER_ADMIN)
export class SuperAdminMastersController {
  constructor(private readonly hierarchy: HierarchyService) {}

  // --- masters -----------------------------------------------------------------

  @Post('masters')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTER_CREATED)
  @Audit({ action: AUDIT_ACTIONS.MASTER_CREATED, resourceType: AUDIT_RESOURCES.USER, targetFromResult: true })
  @ApiOperation({ summary: 'Create a Master', description: 'The role is always MASTER. The master signs in with the e-mail and password set here.' })
  @ApiSuccessResponse(MasterResponseDto, 'The new master', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  createMaster(@Body() dto: CreateManagedAccountDto): Promise<MasterView> {
    return this.hierarchy.createMaster(dto);
  }

  @Get('masters')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTERS_LISTED)
  @ApiOperation({ summary: 'List all Masters', description: 'Each master includes its coin balance, total received, total distributed and client counts.' })
  @ApiPaginatedResponse(MasterResponseDto, 'Paginated masters')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listMasters(@Query() query: ListManagedAccountsQueryDto): Promise<PaginatedResult<MasterView>> {
    return this.hierarchy.listMasters(query);
  }

  @Get('masters/:id')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTER_FETCHED)
  @ApiOperation({ summary: 'Get a Master with its coin figures' })
  @ApiSuccessResponse(MasterResponseDto, 'The master')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getMaster(@Param('id', ParseUUIDPipe) id: string): Promise<MasterView> {
    return this.hierarchy.getMaster(id);
  }

  @Patch('masters/:id')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTER_UPDATED)
  @Audit({ action: AUDIT_ACTIONS.MASTER_UPDATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Update a Master (name, e-mail, password reset)' })
  @ApiSuccessResponse(MasterResponseDto, 'The updated master')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  updateMaster(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateManagedAccountDto): Promise<MasterView> {
    return this.hierarchy.updateMaster(id, dto);
  }

  @Patch('masters/:id/activate')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTER_ACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.MASTER_ACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Activate a Master' })
  @ApiSuccessResponse(MasterResponseDto, 'The activated master')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  activateMaster(@Param('id', ParseUUIDPipe) id: string): Promise<MasterView> {
    return this.hierarchy.setMasterActive(id, true);
  }

  @Patch('masters/:id/deactivate')
  @ResponseMessage(HIERARCHY_MESSAGES.MASTER_DEACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.MASTER_DEACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({
    summary: 'Deactivate a Master',
    description: 'The master can no longer sign in or receive coins. Their clients, balances and history are kept.',
  })
  @ApiSuccessResponse(MasterResponseDto, 'The deactivated master')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  deactivateMaster(@Param('id', ParseUUIDPipe) id: string): Promise<MasterView> {
    return this.hierarchy.setMasterActive(id, false);
  }

  @Get('masters/:id/clients')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENTS_LISTED)
  @ApiOperation({ summary: "View a Master's Clients (with their coin balances)" })
  @ApiPaginatedResponse(ClientResponseDto, 'Paginated clients of the master')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listClientsOfMaster(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListManagedAccountsQueryDto): Promise<PaginatedResult<ClientView>> {
    return this.hierarchy.listClientsOfMaster(id, query);
  }

  // --- coins -------------------------------------------------------------------

  @Get('masters/:id/wallet')
  @ResponseMessage(COIN_MESSAGES.WALLET)
  @ApiOperation({ summary: "View a Master's coin balance, total received and total distributed" })
  @ApiSuccessResponse(MasterWalletResponseDto, 'The master coin figures')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getMasterWallet(@Param('id', ParseUUIDPipe) id: string) {
    return this.hierarchy.getMasterWallet(id);
  }

  @Post('masters/:id/allocations')
  @ResponseMessage(COIN_MESSAGES.ALLOCATED)
  @Audit({
    action: AUDIT_ACTIONS.COINS_ALLOCATED_TO_MASTER,
    resourceType: AUDIT_RESOURCES.WALLET,
    targetParam: 'id',
    summarize: (result) => {
      const { transfer, replayed } = result as CoinAllocationResult;
      return { transferId: transfer.id, amount: transfer.amount, replayed };
    },
  })
  @ApiOperation({
    summary: 'Allocate coins to a Master',
    description:
      'The Super Admin issues coins, so there is no sender balance to reduce. The master wallet is credited and the movement is ' +
      'recorded in the immutable wallet ledger and the coin-transfer history in one transaction. `idempotencyKey` is required: ' +
      'repeating it returns the original allocation (`replayed: true`) and never allocates twice.',
  })
  @ApiSuccessResponse(CoinAllocationResponseDto, 'The allocation', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  allocate(@CurrentUser() actor: SafeUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.hierarchy.allocateToMaster(actor, id, dto);
  }

  @Get('masters/:id/allocations')
  @ResponseMessage(COIN_MESSAGES.LISTED)
  @ApiOperation({
    summary: "View a Master's coin allocation history",
    description: 'Coins received from the Super Admin, allocations to clients and coins returned by deleted clients (filter with `type`).',
  })
  @ApiPaginatedResponse(CoinTransferResponseDto, 'Paginated coin transfers')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listMasterAllocations(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListCoinTransfersQueryDto): Promise<PaginatedResult<CoinTransferView>> {
    return this.hierarchy.listMasterAllocations(id, { type: query.type, from: query.from, to: query.to }, query.page, query.limit);
  }

  // --- system-wide views -------------------------------------------------------

  @Get('users')
  @ResponseMessage(HIERARCHY_MESSAGES.USERS_LISTED)
  @ApiOperation({
    summary: 'List every user in the system',
    description: 'All roles, with each account owning master (`parentId`) and coin balance. Filter by `role`, `parentId`, `isActive`, `search`.',
  })
  @ApiPaginatedResponse(ClientResponseDto, 'Paginated users')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listUsers(@Query() query: SuperAdminListUsersQueryDto): Promise<PaginatedResult<ClientView>> {
    return this.hierarchy.listAllUsers(query);
  }

  @Get('coin-transactions')
  @ResponseMessage(COIN_MESSAGES.LISTED)
  @ApiOperation({ summary: 'System-wide coin transactions', description: 'Every allocation and return, newest first. Filter by `type`, `masterId`, `senderId`, `receiverId` and a date range.' })
  @ApiPaginatedResponse(CoinTransferResponseDto, 'Paginated coin transfers')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listCoinTransactions(@Query() query: AdminListCoinTransfersQueryDto): Promise<PaginatedResult<CoinTransferView>> {
    return this.hierarchy.listAllCoinTransactions(
      { type: query.type, masterId: query.masterId, senderId: query.senderId, receiverId: query.receiverId, from: query.from, to: query.to },
      query.page,
      query.limit,
    );
  }

  @Get('overview')
  @ResponseMessage(HIERARCHY_MESSAGES.OVERVIEW)
  @ApiOperation({ summary: 'Counts of users per role and total coins issued and distributed' })
  @ApiSuccessResponse(SystemOverviewResponseDto, 'The overview')
  getOverview(): Promise<SystemOverview> {
    return this.hierarchy.getOverview();
  }
}
