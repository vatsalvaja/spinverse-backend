import { Module } from '@nestjs/common';
import { AdminGameCategoriesController } from './admin-game-categories.controller';
import { GameCategoriesController } from './game-categories.controller';
import { GameCategoriesRepository } from './game-categories.repository';
import { GameCategoriesService } from './game-categories.service';

@Module({
  controllers: [AdminGameCategoriesController, GameCategoriesController],
  providers: [GameCategoriesService, GameCategoriesRepository],
  exports: [GameCategoriesService],
})
export class GameCategoriesModule {}
