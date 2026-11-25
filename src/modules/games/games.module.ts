import { Module } from '@nestjs/common';
import { GameCategoriesModule } from '../game-categories/game-categories.module';
import { AdminGamesController } from './admin-games.controller';
import { GameCatalogController } from './game-catalog.controller';
import { GameCatalogService } from './game-catalog.service';
import { GamesRepository } from './games.repository';
import { GamesService } from './games.service';

@Module({
  imports: [GameCategoriesModule],
  controllers: [AdminGamesController, GameCatalogController],
  providers: [GamesService, GameCatalogService, GamesRepository],
  exports: [GamesService, GamesRepository],
})
export class GamesModule {}
