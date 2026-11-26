import { Body, Controller, Delete, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
  AllocateCoinsDto,
  CoinAllocationResponseDto,
  CoinTransferResponseDto,
  ListCoinTransfersQueryDto,
} from '../demo-wallet/coin-transfers/coin-transfer.dto';
import type { CoinAllocationResult, CoinTransferView } from '../demo-wallet/coin-transfers/coin-transfer.interface';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { ListWalletTransactionsQueryDto } from '../demo-wallet/dto/list-wallet-transactions-query.dto';
import { TransactionResponseDto } from '../demo-wallet/dto/wallet-response.dto';
import type { TransactionView } from '../demo-wallet/interfaces/demo-wallet.interface';
import { HIERARCHY_MESSAGES, MASTER_API_TAG, MASTER_ROUTE } from './constants/hierarchy.constants';
import { CreateManagedAccountDto, ListManagedAccountsQueryDto, UpdateManagedAccountDto } from './dto/managed-account.dto';
import {
  ClientBalanceResponseDto,
  ClientResponseDto,
  DeleteClientResponseDto,
  MasterWalletResponseDto,
} from './dto/managed-account-response.dto';
import { HierarchyService } from './hierarchy.service';
import type { ClientView, DeleteClientResult } from './interfaces/hierarchy.interface';
import type { SafeUser } from './interfaces/user.interface';

/**
 * Master: manages ONLY their own Clients and the coins they hold.
 *
 * The master is always the authenticated user (`@CurrentUser()`); no id of a master appears in any URL or body.
 * A client of another master answers 404 on every route below, exactly like a client that does not exist.
 * Every route requires the MASTER role: a Client, a plain ADMIN or even a Super Admin gets 403.
 */
@ApiTags(MASTER_API_TAG)
@Controller(MASTER_ROUTE)
@Auth(Role.MASTER)
export class MasterClientsController {
  constructor(
    private readonly hierarchy: HierarchyService,
    private readonly walletService: DemoWalletService,
  ) {}

  // --- own coins ---------------------------------------------------------------

  @Get('wallet')
  @ResponseMessage(COIN_MESSAGES.WALLET)
  @ApiOperation({ summary: 'My coin balance, total received from the Super Admin, total distributed, and client counts' })
  @ApiSuccessResponse(MasterWalletResponseDto, 'My coin figures')
  getWallet(@CurrentUser() master: SafeUser) {
    return this.hierarchy.getOwnWallet(master);
  }

  @Get('coin-transactions')
  @ResponseMessage(COIN_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'My coin transaction history',
    description: 'Coins received from the Super Admin, allocations to my clients and coins returned by deleted clients. Never another master\'s.',
  })
  @ApiPaginatedResponse(CoinTransferResponseDto, 'Paginated coin transfers')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listCoinTransactions(@CurrentUser() master: SafeUser, @Query() query: ListCoinTransfersQueryDto): Promise<PaginatedResult<CoinTransferView>> {
    return this.hierarchy.listOwnCoinTransactions(master, { type: query.type, from: query.from, to: query.to }, query.page, query.limit);
  }

  // --- clients -----------------------------------------------------------------

  @Post('clients')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_CREATED)
  @Audit({ action: AUDIT_ACTIONS.CLIENT_CREATED, resourceType: AUDIT_RESOURCES.USER, targetFromResult: true })
  @ApiOperation({
    summary: 'Create a Client',
    description:
      'The role is always CLIENT and `parentId` is set to the authenticated master automatically. A body that contains `role` or ' +
      '`parentId` is rejected (400). The client starts with 0 coins.',
  })
  @ApiSuccessResponse(ClientResponseDto, 'The new client', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  createClient(@CurrentUser() master: SafeUser, @Body() dto: CreateManagedAccountDto): Promise<ClientView> {
    return this.hierarchy.createClient(master, dto);
  }

  @Get('clients')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENTS_LISTED)
  @ApiOperation({ summary: 'List my Clients (with their coin balances)' })
  @ApiPaginatedResponse(ClientResponseDto, 'Paginated clients')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listClients(@CurrentUser() master: SafeUser, @Query() query: ListManagedAccountsQueryDto): Promise<PaginatedResult<ClientView>> {
    return this.hierarchy.listOwnClients(master, query);
  }

  @Get('clients/:id')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_FETCHED)
  @ApiOperation({ summary: 'Get one of my Clients' })
  @ApiSuccessResponse(ClientResponseDto, 'The client')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getClient(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string): Promise<ClientView> {
    return this.hierarchy.getOwnClient(master, id);
  }

  @Patch('clients/:id')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_UPDATED)
  @Audit({ action: AUDIT_ACTIONS.CLIENT_UPDATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Update one of my Clients (name, e-mail, password reset)' })
  @ApiSuccessResponse(ClientResponseDto, 'The updated client')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  updateClient(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateManagedAccountDto): Promise<ClientView> {
    return this.hierarchy.updateOwnClient(master, id, dto);
  }

  @Patch('clients/:id/activate')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_ACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.CLIENT_ACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Activate one of my Clients' })
  @ApiSuccessResponse(ClientResponseDto, 'The activated client')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  activateClient(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string): Promise<ClientView> {
    return this.hierarchy.setOwnClientActive(master, id, true);
  }

  @Patch('clients/:id/deactivate')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_DEACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.CLIENT_DEACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Deactivate one of my Clients', description: 'The client can no longer sign in or receive coins; the balance is kept.' })
  @ApiSuccessResponse(ClientResponseDto, 'The deactivated client')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  deactivateClient(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string): Promise<ClientView> {
    return this.hierarchy.setOwnClientActive(master, id, false);
  }

  @Delete('clients/:id')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_DELETED)
  @Audit({
    action: AUDIT_ACTIONS.CLIENT_DELETED,
    resourceType: AUDIT_RESOURCES.USER,
    targetParam: 'id',
    summarize: (result) => ({ coinsReturned: (result as DeleteClientResult).coinsReturned }),
  })
  @ApiOperation({
    summary: 'Delete one of my Clients',
    description:
      'Safe delete: in one transaction the coins the client still holds go back to me (a CLIENT_RECLAIM transfer), the account is ' +
      'deactivated and marked deleted, and its sessions are revoked. The wallet, wallet ledger, coin transfers and game history are ' +
      'kept untouched. The deleted client disappears from every list and can never sign in again; the e-mail stays reserved.',
  })
  @ApiSuccessResponse(DeleteClientResponseDto, 'The result')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN)
  deleteClient(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string): Promise<DeleteClientResult> {
    return this.hierarchy.deleteOwnClient(master, id);
  }

  // --- coins of a client -------------------------------------------------------

  @Post('clients/:id/allocations')
  @ResponseMessage(COIN_MESSAGES.ALLOCATED)
  @Audit({
    action: AUDIT_ACTIONS.COINS_ALLOCATED_TO_CLIENT,
    resourceType: AUDIT_RESOURCES.WALLET,
    targetParam: 'id',
    summarize: (result) => {
      const { transfer, replayed } = result as CoinAllocationResult;
      return { transferId: transfer.id, amount: transfer.amount, replayed };
    },
  })
  @ApiOperation({
    summary: 'Allocate coins to one of my Clients',
    description:
      'Moves coins from my balance to the client in one atomic transaction. Refused with 409 if the amount is more than my available ' +
      'balance (balances never go negative). `idempotencyKey` is required: repeating it returns the original allocation ' +
      '(`replayed: true`) and never allocates twice.',
  })
  @ApiSuccessResponse(CoinAllocationResponseDto, 'The allocation', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  allocate(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.hierarchy.allocateToOwnClient(master, id, dto);
  }

  @Get('clients/:id/balance')
  @ResponseMessage(HIERARCHY_MESSAGES.CLIENT_BALANCE)
  @ApiOperation({ summary: "One of my Client's current coin balance" })
  @ApiSuccessResponse(ClientBalanceResponseDto, 'The balance')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getClientBalance(@CurrentUser() master: SafeUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.hierarchy.getOwnClientBalance(master, id);
  }

  @Get('clients/:id/transactions')
  @ResponseMessage(COIN_MESSAGES.LISTED)
  @ApiOperation({ summary: "Coin allocation history of one of my Clients (what I gave them and what they returned)" })
  @ApiPaginatedResponse(CoinTransferResponseDto, 'Paginated coin transfers')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listClientTransactions(
    @CurrentUser() master: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCoinTransfersQueryDto,
  ): Promise<PaginatedResult<CoinTransferView>> {
    return this.hierarchy.listOwnClientTransactions(master, id, { type: query.type, from: query.from, to: query.to }, query.page, query.limit);
  }

  @Get('clients/:id/wallet-transactions')
  @ResponseMessage(COIN_MESSAGES.LISTED)
  @ApiOperation({
    summary: "Full wallet ledger of one of my Clients",
    description: 'Every credit and debit of the client wallet: my allocations and also the client game entries and winnings.',
  })
  @ApiPaginatedResponse(TransactionResponseDto, 'Paginated wallet ledger entries')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async listClientWalletTransactions(
    @CurrentUser() master: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListWalletTransactionsQueryDto,
  ): Promise<PaginatedResult<TransactionView>> {
    const client = await this.hierarchy.getOwnClient(master, id); // 404 unless this client belongs to the master
    return this.walletService.listTransactions(client.id, query);
  }
}
