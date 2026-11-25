import { Injectable } from '@nestjs/common';
import { GamePackageEvent, GameVersion, PackageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GameVersionState } from './enums/game-version-state.enum';
import { PackageEventType } from './enums/package-event-type.enum';
import { CreateGameVersionData } from './interfaces/game-package.interface';

@Injectable()
export class GamePackagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- versions -------------------------------------------------------------

  findVersions(gameId: string): Promise<GameVersion[]> {
    return this.prisma.gameVersion.findMany({ where: { gameId }, orderBy: { uploadedAt: 'desc' } });
  }

  findVersionById(gameId: string, versionId: string): Promise<GameVersion | null> {
    return this.prisma.gameVersion.findFirst({ where: { id: versionId, gameId } });
  }

  findVersionByNumber(gameId: string, version: string): Promise<GameVersion | null> {
    return this.prisma.gameVersion.findUnique({ where: { gameId_version: { gameId, version } } });
  }

  /** Stores a new version and its UPLOADED history entry together. */
  createVersion(data: CreateGameVersionData): Promise<GameVersion> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.gameVersion.create({
        data: {
          gameId: data.gameId,
          version: data.version,
          releaseNotes: data.releaseNotes,
          fileName: data.fileName,
          storageKey: data.storageKey,
          sizeBytes: data.sizeBytes,
          unpackedBytes: data.unpackedBytes,
          fileCount: data.fileCount,
          checksum: data.checksum,
          manifest: data.manifest as unknown as Prisma.InputJsonObject,
          entryPoint: data.entryPoint,
          validation: data.validation as unknown as Prisma.InputJsonObject,
          uploadedById: data.uploadedById,
        },
      });
      await tx.gamePackageEvent.create({
        data: {
          gameId: data.gameId,
          versionId: created.id,
          version: data.version,
          type: PackageEventType.UPLOADED,
          actorId: data.uploadedById,
        },
      });
      return created;
    });
  }

  // --- lifecycle transitions (each updates the version, the game pointers and the history together) ---

  /** The version becomes INSTALLED and the game's current installed version. */
  async markInstalled(version: GameVersion, actorId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.gameVersion.update({
        where: { id: version.id },
        data: { state: GameVersionState.INSTALLED, installedAt: now },
      }),
      this.prisma.game.update({
        where: { id: version.gameId },
        data: {
          installedVersion: version.version,
          installedAt: now,
          packageStatus: PackageStatus.INSTALLED,
          entryPoint: version.entryPoint,
        },
      }),
      this.event(version.gameId, version, PackageEventType.INSTALLED, actorId),
    ]);
  }

  /**
   * The version goes back to UPLOADED. If it was the game's installed version, the game has nothing installed
   * until another version is installed or rolled back to.
   */
  async markUninstalled(version: GameVersion, wasInstalledVersion: boolean, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.gameVersion.update({
        where: { id: version.id },
        data: { state: GameVersionState.UPLOADED, installedAt: null },
      }),
      ...(wasInstalledVersion
        ? [
            this.prisma.game.update({
              where: { id: version.gameId },
              data: { installedVersion: null, installedAt: null, packageStatus: PackageStatus.NOT_INSTALLED, entryPoint: null },
            }),
          ]
        : []),
      this.event(version.gameId, version, PackageEventType.UNINSTALLED, actorId),
    ]);
  }

  async publish(gameId: string, version: GameVersion, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: { publishedVersion: version.version, publishedAt: new Date() },
      }),
      this.event(gameId, version, PackageEventType.PUBLISHED, actorId),
    ]);
  }

  async unpublish(gameId: string, version: GameVersion, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: { publishedVersion: null, publishedAt: null },
      }),
      this.event(gameId, version, PackageEventType.UNPUBLISHED, actorId),
    ]);
  }

  /**
   * Switches the installed version to `target`. When the game is published, players are moved to
   * `target` as well (`republish`), which is what makes a rollback take effect immediately.
   */
  async rollback(
    gameId: string,
    target: GameVersion,
    options: { republish: boolean; note: string; actorId: string },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.game.update({
        where: { id: gameId },
        data: {
          installedVersion: target.version,
          installedAt: new Date(),
          entryPoint: target.entryPoint,
          packageStatus: PackageStatus.INSTALLED,
          ...(options.republish ? { publishedVersion: target.version, publishedAt: new Date() } : {}),
        },
      }),
      this.event(gameId, target, PackageEventType.ROLLED_BACK, options.actorId, options.note),
    ]);
  }

  // --- history --------------------------------------------------------------

  async findEvents(params: {
    gameId: string;
    skip: number;
    take: number;
  }): Promise<{ items: GamePackageEvent[]; total: number }> {
    const where: Prisma.GamePackageEventWhereInput = { gameId: params.gameId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.gamePackageEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.gamePackageEvent.count({ where }),
    ]);
    return { items, total };
  }

  private event(
    gameId: string,
    version: GameVersion,
    type: PackageEventType,
    actorId: string,
    note?: string,
  ) {
    return this.prisma.gamePackageEvent.create({
      data: { gameId, versionId: version.id, version: version.version, type, actorId, note },
    });
  }
}
