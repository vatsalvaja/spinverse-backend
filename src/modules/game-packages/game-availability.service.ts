import { Injectable, NotFoundException } from '@nestjs/common';
import { GameStatus } from '../games/enums/game-status.enum';
import { GameVisibility } from '../games/enums/game-visibility.enum';
import { GamesRepository } from '../games/games.repository';
import { PACKAGE_ERRORS } from './constants/game-packages.constants';
import { GameVersionState } from './enums/game-version-state.enum';
import { GamePackagesRepository } from './game-packages.repository';
import { GameVersion } from '@prisma/client';
import { GameWithCategory } from '../games/interfaces/game.interface';
import { AvailabilityCheck, AvailabilityReport, LaunchableGame } from './interfaces/game-package.interface';
import { PackageStorageService } from './package-storage.service';

/**
 * The single place that decides whether a game can be played. A game is launchable only when
 * it is enabled (ACTIVE), not private, in an active category, published, and the published
 * version is installed with its files present. Every failure looks the same to the caller.
 */
@Injectable()
export class GameAvailabilityService {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly packagesRepository: GamePackagesRepository,
    private readonly storage: PackageStorageService,
  ) {}

  async getLaunchable(gameId: string): Promise<LaunchableGame> {
    const game = await this.gamesRepository.findByGameId(gameId);
    if (!game) throw new NotFoundException(PACKAGE_ERRORS.GAME_UNAVAILABLE);

    // The same checks the admin availability report shows, so the report can never disagree with the launch.
    const report = await this.inspectGame(game);
    if (!report.launchable || !report.version) throw new NotFoundException(PACKAGE_ERRORS.GAME_UNAVAILABLE);
    return { game, version: report.version };
  }

  /** Every availability check for a game, with the reason for each failure (admin view). */
  async inspectGame(game: GameWithCategory): Promise<AvailabilityReport> {
    const enabled = game.status === GameStatus.ACTIVE;
    const visible = game.visibility !== GameVisibility.PRIVATE;
    const categoryActive = game.category.isActive;
    const published = !!game.publishedVersion;

    let version: GameVersion | null = null;
    let installed = false;
    let filesPresent = false;
    if (game.publishedVersion) {
      version = await this.packagesRepository.findVersionByNumber(game.id, game.publishedVersion);
      installed = !!version && version.state === GameVersionState.INSTALLED;
      filesPresent = installed && (await this.storage.isInstalled(game.gameId, game.publishedVersion));
    }

    const checks: AvailabilityCheck[] = [
      { id: 'enabled', label: 'Game is enabled', passed: enabled, detail: enabled ? null : `Game status is ${game.status}` },
      { id: 'visible', label: 'Game is not private', passed: visible, detail: visible ? null : 'Visibility is PRIVATE' },
      { id: 'categoryActive', label: 'Category is active', passed: categoryActive, detail: categoryActive ? null : 'The game category is inactive' },
      { id: 'published', label: 'A version is published', passed: published, detail: published ? null : 'No version is published' },
      {
        id: 'publishedVersionInstalled',
        label: 'Published version is installed',
        passed: installed,
        detail: installed ? null : published ? 'The published version is not installed' : 'Nothing to check: no version is published',
      },
      {
        id: 'filesPresent',
        label: 'Installed files are present',
        passed: filesPresent,
        detail: filesPresent ? null : published ? 'The installed files are missing on the server' : 'Nothing to check: no version is published',
      },
    ];
    const launchable = checks.every((check) => check.passed);

    return {
      launchable,
      checks,
      status: game.status,
      packageStatus: game.packageStatus,
      installedVersion: game.installedVersion,
      publishedVersion: game.publishedVersion,
      version: launchable ? version : null,
    };
  }
}
