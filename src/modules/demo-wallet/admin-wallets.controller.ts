import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/interfaces/user.interface';
import { ADMIN_WALLET_API_TAG, ADMIN_WALLETS_ROUTE, WALLET_MESSAGES } from './constants/demo-wallet.constants';
import { ListWalletsQueryDto, WalletStatsQueryDto } from './dto/admin-wallet-queries.dto';
import { AdminListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { CreditWalletDto, DebitWalletDto } from './dto/wallet-adjustment.dto';
import {
  AdjustmentResponseDto,
  AdminWalletResponseDto,
  TransactionResponseDto,
  WalletStatsResponseDto,
} from './dto/wallet-response.dto';
import { AdminWalletService } from './admin-wallet.service';
import type { AdminWalletView, TransactionView, WalletStats } from './interfaces/demo-wallet.interface';
import type { AdjustmentResult } from './interfaces/demo-wallet.interface';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { Audit } from '../audit/decorators/audit.decorator';

/** The ledger already holds the full record; the audit entry keeps just the pointers and the money moved. */
const summarizeAdjustment = (result: unknown): Record<string, unknown> => {
  const adjustment = result as AdjustmentResult;
  return {
    transactionId: adjustment.transaction.id,
    type: adjustment.transaction.type,
    amount: adjustment.transaction.amount,
    balanceAfter: adjustment.balance,
    replayed: adjustment.replayed,
  };
};

/** Demo wallet administration. Every route requires the ADMIN role. */
@ApiTags(ADMIN_WALLET_API_TAG)
@Controller(ADMIN_WALLETS_ROUTE)
@Auth(Role.ADMIN)
export class AdminWalletsController {
  constructor(private readonly adminWalletService: AdminWalletService) {}

  @Get('wallets')
  @ResponseMessage(WALLET_MESSAGES.WALLETS_LISTED)
  @ApiOperation({ summary: 'List demo wallets (search by player, filter by status, sort by balance or date)' })
  @ApiPaginatedResponse(AdminWalletResponseDto, 'Paginated wallets')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listWallets(@Query() query: ListWalletsQueryDto): Promise<PaginatedResult<AdminWalletView>> {
    return this.adminWalletService.listWallets(query);
  }

  @Get('wallets/:userId')
  @ResponseMessage(WALLET_MESSAGES.FETCHED)
  @ApiOperation({ summary: "One player's wallet and balance (`:userId` is the player's user id)" })
  @ApiSuccessResponse(AdminWalletResponseDto, 'The wallet')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN)
  getWallet(@Param('userId', ParseUUIDPipe) userId: string): Promise<AdminWalletView> {
    return this.adminWalletService.getWallet(userId);
  }

  @Post('wallets/:userId/credit')
  @Audit({ action: AUDIT_ACTIONS.WALLET_CREDITED, resourceType: AUDIT_RESOURCES.WALLET, targetParam: 'userId', summarize: summarizeAdjustment })
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(WALLET_MESSAGES.ADJUSTED)
  @ApiOperation({
    summary: 'Add demo credits to a player',
    description:
      'A reason is required and is stored in the ledger with your administrator id. Send an `idempotencyKey` to make ' +
      'retries safe: the same key returns the original result instead of crediting twice. You cannot adjust your own wallet.',
  })
  @ApiSuccessResponse(AdjustmentResponseDto, 'The ledger entry and the new balance')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  credit(
    @CurrentUser() actor: SafeUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreditWalletDto,
  ): Promise<AdjustmentResult> {
    return this.adminWalletService.credit(actor, userId, dto);
  }

  @Post('wallets/:userId/debit')
  @Audit({ action: AUDIT_ACTIONS.WALLET_DEBITED, resourceType: AUDIT_RESOURCES.WALLET, targetParam: 'userId', summarize: summarizeAdjustment })
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(WALLET_MESSAGES.ADJUSTED)
  @ApiOperation({
    summary: 'Take demo credits from a player',
    description:
      'Refused with 409 if the balance cannot cover it (a balance never goes below zero). A reason is required and ' +
      'is stored in the ledger. Supports `idempotencyKey` like the credit endpoint.',
  })
  @ApiSuccessResponse(AdjustmentResponseDto, 'The ledger entry and the new balance')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  debit(
    @CurrentUser() actor: SafeUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DebitWalletDto,
  ): Promise<AdjustmentResult> {
    return this.adminWalletService.debit(actor, userId, dto);
  }

  @Get('wallet-transactions')
  @ResponseMessage(WALLET_MESSAGES.TRANSACTIONS)
  @ApiOperation({
    summary: 'Ledger history across wallets (filter by user, type, direction, game and date range)',
    description: 'Newest first. Ledger entries are immutable: there is no way to edit or delete them.',
  })
  @ApiPaginatedResponse(TransactionResponseDto, 'Paginated ledger entries')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  listTransactions(@Query() query: AdminListWalletTransactionsQueryDto): Promise<PaginatedResult<TransactionView>> {
    return this.adminWalletService.listTransactions(query);
  }

  @Get('wallet-stats')
  @ResponseMessage(WALLET_MESSAGES.STATS)
  @ApiOperation({
    summary: 'Wallet statistics',
    description:
      'Wallet counts, credits held, everything credited and debited, a consistency check (`discrepancy` is 0 when the ' +
      'books balance), and ledger totals per transaction type for an optional date range.',
  })
  @ApiSuccessResponse(WalletStatsResponseDto, 'The statistics')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  getStats(@Query() query: WalletStatsQueryDto): Promise<WalletStats> {
    return this.adminWalletService.getStats(query);
  }
}
