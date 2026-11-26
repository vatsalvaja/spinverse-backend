import { Module } from '@nestjs/common';
import { AdminWalletService } from './admin-wallet.service';
import { CoinTransferRepository } from './coin-transfers/coin-transfer.repository';
import { CoinTransferService } from './coin-transfers/coin-transfer.service';
import { AdminWalletsController } from './admin-wallets.controller';
import { DemoWalletController } from './demo-wallet.controller';
import { DemoWalletRepository } from './demo-wallet.repository';
import { DemoWalletService } from './demo-wallet.service';
import { WalletLedgerRepository } from './wallet-ledger.repository';

@Module({
  controllers: [DemoWalletController, AdminWalletsController],
  providers: [DemoWalletService, AdminWalletService, DemoWalletRepository, WalletLedgerRepository, CoinTransferRepository, CoinTransferService],
  /**
   * `WalletLedgerRepository` is exported so game rounds can post entries inside their own transaction;
   * `CoinTransferService` carries the Super Admin -> Master -> Client coin flow on top of the same ledger.
   */
  exports: [DemoWalletService, AdminWalletService, WalletLedgerRepository, CoinTransferService],
})
export class DemoWalletModule {}
