import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GameVersion } from '@prisma/client';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GameWithCategory } from '../games/interfaces/game.interface';
import { GamesService } from '../games/games.service';
import { SafeUser } from '../users/interfaces/user.interface';
import { PACKAGE_ERRORS } from './constants/game-packages.constants';
import { PACKAGE_CONTRACT, ZIP_LIMITS } from './constants/package-contract.constants';
import { UploadVersionDto } from './dto/upload-version.dto';
import { GameVersionState } from './enums/game-version-state.enum';
import { GamePackagesRepository } from './game-packages.repository';
import { AvailabilityReport, GameVersionView, PackageEvent, UploadedZipFile } from './interfaces/game-package.interface';
import { GameAvailabilityService } from './game-availability.service';
import { PackageStorageService } from './package-storage.service';
import { PackageValidationService } from './package-validation.service';
import { readZip } from './utils/zip-reader.util';

const MAX_REPORTED_ERRORS = 50;

/** Package lifecycle: upload -> install -> publish, plus unpublish and rollback. */
@Injectable()
export class GamePackagesService {
  constructor(
    private readonly gamesService: GamesService,
    private readonly packagesRepository: GamePackagesRepository,
    private readonly validationService: PackageValidationService,
    private readonly storage: PackageStorageService,
    private readonly availability: GameAvailabilityService,
  ) {}

  /** Validates the ZIP against the package contract and stores it as a new, uninstalled version. */
  async upload(
    gameUuid: string,
    file: UploadedZipFile | undefined,
    dto: UploadVersionDto,
    actor: SafeUser,
  ): Promise<GameVersionView> {
    const game = await this.gamesService.getById(gameUuid);

    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException(PACKAGE_ERRORS.NO_FILE);
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException(PACKAGE_ERRORS.NOT_A_ZIP_NAME);
    }

    const result = this.validationService.validate(file.buffer, game.gameId);
    if (!result.valid || !result.manifest) {
      const shown = result.errors.slice(0, MAX_REPORTED_ERRORS);
      if (result.errors.length > shown.length) shown.push(`...and ${result.errors.length - shown.length} more problems.`);
      throw new UnprocessableEntityException({ message: shown, error: PACKAGE_ERRORS.INVALID_PACKAGE });
    }
    const manifest = result.manifest;

    if (await this.packagesRepository.findVersionByNumber(game.id, manifest.version)) {
      throw new ConflictException(PACKAGE_ERRORS.VERSION_EXISTS);
    }

    let storageKey: string;
    try {
      storageKey = await this.storage.saveZip(game.gameId, manifest.version, file.buffer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ConflictException(PACKAGE_ERRORS.VERSION_EXISTS);
      throw error;
    }

    try {
      const created = await this.packagesRepository.createVersion({
        gameId: game.id,
        version: manifest.version,
        releaseNotes: dto.releaseNotes,
        fileName: file.originalname,
        storageKey,
        sizeBytes: file.buffer.length,
        unpackedBytes: result.unpackedBytes,
        fileCount: result.fileCount,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        manifest,
        entryPoint: manifest.entryPoint,
        validation: { checks: result.checks, warnings: result.warnings },
        uploadedById: actor.id,
      });
      return this.toView(created, game);
    } catch (error) {
      await this.storage.removeVersion(game.gameId, manifest.version);
      throw error;
    }
  }

  async listVersions(gameUuid: string): Promise<GameVersionView[]> {
    const game = await this.gamesService.getById(gameUuid);
    const versions = await this.packagesRepository.findVersions(game.id);
    return versions.map((version) => this.toView(version, game));
  }

  async getVersion(gameUuid: string, versionId: string): Promise<GameVersionView> {
    const game = await this.gamesService.getById(gameUuid);
    return this.toView(await this.getVersionOrFail(game.id, versionId), game);
  }

  /** Unpacks a stored version on the server and makes it the game's current installed version. */
  async install(gameUuid: string, versionId: string, actor: SafeUser): Promise<GameVersionView> {
    const game = await this.gamesService.getById(gameUuid);
    const version = await this.getVersionOrFail(game.id, versionId);

    if (version.state === GameVersionState.INSTALLED) {
      if (game.installedVersion === version.version) return this.toView(version, game); // already done
      throw new ConflictException(PACKAGE_ERRORS.ALREADY_INSTALLED_USE_ROLLBACK);
    }

    const zip = await this.readStoredZip(version);
    const archive = readZip(zip, {
      maxEntries: ZIP_LIMITS.maxEntries,
      maxTotalBytes: PACKAGE_CONTRACT.maxPackageBytes,
    });
    if (archive.errors.length > 0) {
      throw new UnprocessableEntityException({ message: archive.errors, error: PACKAGE_ERRORS.INSTALL_FAILED });
    }

    try {
      const ignored = new Set(PACKAGE_CONTRACT.structure.ignoredFileNames);
      await this.storage.extract(
        game.gameId,
        version.version,
        archive.entries.filter((entry) => !ignored.has(entry.path.split('/').pop() ?? '')),
      );
    } catch {
      throw new UnprocessableEntityException(PACKAGE_ERRORS.INSTALL_FAILED);
    }

    await this.packagesRepository.markInstalled(version, actor.id);
    return this.getVersion(gameUuid, versionId);
  }

  /**
   * Removes the unpacked files of an installed version (the stored ZIP stays, so it can be installed again).
   * A version that players currently receive cannot be uninstalled: unpublish the game first.
   */
  async uninstall(gameUuid: string, versionId: string, actor: SafeUser): Promise<GameVersionView> {
    const game = await this.gamesService.getById(gameUuid);
    const version = await this.getVersionOrFail(game.id, versionId);

    if (version.state !== GameVersionState.INSTALLED) throw new ConflictException(PACKAGE_ERRORS.NOT_INSTALLED);
    if (game.publishedVersion === version.version) throw new ConflictException(PACKAGE_ERRORS.UNPUBLISH_FIRST);

    await this.packagesRepository.markUninstalled(version, game.installedVersion === version.version, actor.id);
    // The record is already correct; removing the files afterwards cannot leave the game half-installed.
    await this.storage.removeInstalled(game.gameId, version.version);
    return this.getVersion(gameUuid, versionId);
  }

  /** Whether the game can be launched right now, and the reason for every failing check. */
  async getAvailability(gameUuid: string): Promise<AvailabilityReport> {
    const game = await this.gamesService.getById(gameUuid);
    const { version: _version, ...report } = await this.availability.inspectGame(game);
    return { ...report, version: null };
  }

  /** Players receive the currently installed version from now on. */
  async publish(gameUuid: string, actor: SafeUser): Promise<GameWithCategory> {
    const game = await this.gamesService.getById(gameUuid);
    if (!game.installedVersion) throw new ConflictException(PACKAGE_ERRORS.NOTHING_INSTALLED);
    if (game.publishedVersion === game.installedVersion) return game; // already published

    const version = await this.packagesRepository.findVersionByNumber(game.id, game.installedVersion);
    if (!version || !(await this.storage.isInstalled(game.gameId, version.version))) {
      throw new ConflictException(PACKAGE_ERRORS.FILES_MISSING);
    }

    await this.packagesRepository.publish(game.id, version, actor.id);
    return this.gamesService.getById(gameUuid);
  }

  /** Players can no longer launch the game; the installed files are kept. */
  async unpublish(gameUuid: string, actor: SafeUser): Promise<GameWithCategory> {
    const game = await this.gamesService.getById(gameUuid);
    if (!game.publishedVersion) return game; // already unpublished

    const version = await this.packagesRepository.findVersionByNumber(game.id, game.publishedVersion);
    if (version) await this.packagesRepository.unpublish(game.id, version, actor.id);
    return this.gamesService.getById(gameUuid);
  }

  /**
   * Switches back to an earlier installed version. If the game is published, players move to that
   * version immediately (old launch links stop working).
   */
  async rollback(gameUuid: string, versionId: string, actor: SafeUser): Promise<GameWithCategory> {
    const game = await this.gamesService.getById(gameUuid);
    const target = await this.getVersionOrFail(game.id, versionId);

    if (target.state !== GameVersionState.INSTALLED) throw new ConflictException(PACKAGE_ERRORS.NOT_ROLLBACK_TARGET);
    if (game.installedVersion === target.version) throw new ConflictException(PACKAGE_ERRORS.ALREADY_CURRENT);
    if (!(await this.storage.isInstalled(game.gameId, target.version))) {
      throw new ConflictException(PACKAGE_ERRORS.FILES_MISSING);
    }

    await this.packagesRepository.rollback(game.id, target, {
      republish: game.publishedVersion !== null,
      note: `Rolled back from ${game.installedVersion ?? 'none'} to ${target.version}`,
      actorId: actor.id,
    });
    return this.gamesService.getById(gameUuid);
  }

  async listEvents(gameUuid: string, query: PaginationQueryDto): Promise<PaginatedResult<PackageEvent>> {
    const game = await this.gamesService.getById(gameUuid);
    const { items, total } = await this.packagesRepository.findEvents({
      gameId: game.id,
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  private async getVersionOrFail(gameId: string, versionId: string): Promise<GameVersion> {
    const version = await this.packagesRepository.findVersionById(gameId, versionId);
    if (!version) throw new NotFoundException(PACKAGE_ERRORS.VERSION_NOT_FOUND);
    return version;
  }

  /** Reads the stored ZIP and refuses to use it if it no longer matches the checksum recorded at upload. */
  private async readStoredZip(version: GameVersion): Promise<Buffer> {
    let zip: Buffer;
    try {
      zip = await this.storage.readZip(version.storageKey);
    } catch {
      throw new ConflictException(PACKAGE_ERRORS.FILES_MISSING);
    }
    if (createHash('sha256').update(zip).digest('hex') !== version.checksum) {
      throw new ConflictException(PACKAGE_ERRORS.INTEGRITY_FAILED);
    }
    return zip;
  }

  private toView(version: GameVersion, game: GameWithCategory): GameVersionView {
    return {
      ...version,
      isInstalledVersion: game.installedVersion === version.version,
      isPublishedVersion: game.publishedVersion === version.version,
    };
  }
}
