import { Module } from '@nestjs/common';
import { DemoWalletModule } from '../demo-wallet/demo-wallet.module';
import { GamePackagesModule } from '../game-packages/game-packages.module';
import { GamesModule } from '../games/games.module';
import { AdminGameRoundsController } from './admin-game-rounds.controller';
import { GAME_ENGINES } from './constants/game-engine.constants';
import { createGameEngines } from './engines/game-engine-list';
import { GameEngineRegistry } from './game-engine.registry';
import { GameEnginesController } from './game-engines.controller';
import { GamePlayController } from './game-play.controller';
import { GameRoundsRepository } from './game-rounds.repository';
import { GameRoundsService } from './game-rounds.service';
import { GameSessionsRepository } from './game-sessions.repository';
import { GameSessionsService } from './game-sessions.service';
import { RoundLifecycleService } from './round-lifecycle.service';

@Module({
  imports: [DemoWalletModule, GamePackagesModule, GamesModule],
  controllers: [GamePlayController, GameEnginesController, AdminGameRoundsController],
  providers: [
    { provide: GAME_ENGINES, useFactory: createGameEngines },
    GameEngineRegistry,
    GameSessionsService,
    GameRoundsService,
    RoundLifecycleService,
    GameSessionsRepository,
    GameRoundsRepository,
  ],
})
export class GameEngineModule {}
