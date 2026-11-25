import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/interfaces/user.interface';
import { WALLET_API_TAG, WALLET_MESSAGES, WALLET_ROUTE } from './constants/demo-wallet.constants';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { BalanceResponseDto, TransactionResponseDto, WalletResponseDto } from './dto/wallet-response.dto';
import { DemoWalletService } from './demo-wallet.service';
import type { TransactionView, WalletView } from './interfaces/demo-wallet.interface';

/**
 * A player's own demo wallet. Read-only: the balance can only change through the server (game entries, winnings,
 * and administrator adjustments), never by anything the client sends.
 */
@ApiTags(WALLET_API_TAG)
@Controller(WALLET_ROUTE)
@Auth()
export class DemoWalletController {
  constructor(private readonly walletService: DemoWalletService) {}

  @Get()
  @ResponseMessage(WALLET_MESSAGES.FETCHED)
  @ApiOperation({
    summary: 'My demo wallet',
    description: 'Free demo credits with no cash value. The wallet is created, with the initial credits, the first time it is needed.',
  })
  @ApiSuccessResponse(WalletResponseDto, 'The wallet')
  getWallet(@CurrentUser() user: SafeUser): Promise<WalletView> {
    return this.walletService.getOrCreate(user.id);
  }

  @Get('balance')
  @ResponseMessage(WALLET_MESSAGES.BALANCE)
  @ApiOperation({ summary: 'My current demo balance' })
  @ApiSuccessResponse(BalanceResponseDto, 'The balance')
  getBalance(@CurrentUser() user: SafeUser): Promise<{ balance: number; status: string }> {
    return this.walletService.getBalance(user.id);
  }

  @Get('transactions')
  @ResponseMessage(WALLET_MESSAGES.TRANSACTIONS)
  @ApiOperation({
    summary: 'My transaction history (newest first)',
    description: 'Every credit and debit of my wallet, with the balance before and after. Filter by `type`, `direction` and a date range.',
  })
  @ApiPaginatedResponse(TransactionResponseDto, 'Paginated transactions')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  getTransactions(
    @CurrentUser() user: SafeUser,
    @Query() query: ListWalletTransactionsQueryDto,
  ): Promise<PaginatedResult<TransactionView>> {
    return this.walletService.listTransactions(user.id, query);
  }
}
