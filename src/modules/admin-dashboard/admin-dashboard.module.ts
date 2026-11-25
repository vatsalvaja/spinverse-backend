import { Module } from '@nestjs/common';
import { DemoWalletModule } from '../demo-wallet/demo-wallet.module';
import { GameHistoryModule } from '../game-history/game-history.module';
import { GamesModule } from '../games/games.module';
import { UsersModule } from '../users/users.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';

/** Admin dashboard and reports: composition of the existing modules, with no data of its own. */
@Module({
  imports: [UsersModule, GamesModule, GameHistoryModule, DemoWalletModule],
  controllers: [AdminDashboardController, AdminReportsController],
  providers: [AdminDashboardService, AdminReportsService],
})
export class AdminDashboardModule {}
