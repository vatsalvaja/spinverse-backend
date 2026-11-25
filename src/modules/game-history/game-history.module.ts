import { Module } from '@nestjs/common';
import { DemoWalletModule } from '../demo-wallet/demo-wallet.module';
import { GamesModule } from '../games/games.module';
import { UsersModule } from '../users/users.module';
import { AdminGameHistoryController } from './admin-game-history.controller';
import { GameHistoryController } from './game-history.controller';
import { GameHistoryRepository } from './game-history.repository';
import { GameHistoryService } from './game-history.service';

@Module({
  imports: [DemoWalletModule, GamesModule, UsersModule],
  controllers: [GameHistoryController, AdminGameHistoryController],
  providers: [GameHistoryService, GameHistoryRepository],
  /** Exported for the admin dashboard and reports, which reuse the same records and statistics. */
  exports: [GameHistoryService, GameHistoryRepository],
})
export class GameHistoryModule {}
