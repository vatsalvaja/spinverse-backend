import { Module } from '@nestjs/common';
import { AdminWalletService } from './admin-wallet.service';
import { AdminWalletsController } from './admin-wallets.controller';
import { DemoWalletController } from './demo-wallet.controller';
import { DemoWalletRepository } from './demo-wallet.repository';
import { DemoWalletService } from './demo-wallet.service';
import { WalletLedgerRepository } from './wallet-ledger.repository';

@Module({
  controllers: [DemoWalletController, AdminWalletsController],
  providers: [DemoWalletService, AdminWalletService, DemoWalletRepository, WalletLedgerRepository],
  /** `WalletLedgerRepository` is exported so game rounds can post entries inside their own transaction. */
  exports: [DemoWalletService, AdminWalletService, WalletLedgerRepository],
})
export class DemoWalletModule {}
