import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { packagesConfig } from '../../config/packages.config';
import { GamesModule } from '../games/games.module';
import { AdminGamePackagesController } from './admin-game-packages.controller';
import { GameAvailabilityService } from './game-availability.service';
import { GameLaunchController } from './game-launch.controller';
import { GameLaunchService } from './game-launch.service';
import { GamePackagesRepository } from './game-packages.repository';
import { GamePackagesService } from './game-packages.service';
import { PackageStorageService } from './package-storage.service';
import { PackageValidationService } from './package-validation.service';

@Module({
  imports: [ConfigModule.forFeature(packagesConfig), GamesModule],
  controllers: [AdminGamePackagesController, GameLaunchController],
  providers: [
    GamePackagesService,
    GamePackagesRepository,
    PackageValidationService,
    PackageStorageService,
    GameAvailabilityService,
    GameLaunchService,
  ],
  /** The game engine uses it so only launchable games can start a play session. */
  exports: [GameAvailabilityService],
})
export class GamePackagesModule {}
