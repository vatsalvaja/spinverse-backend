import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GameVersion } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { GamesRepository } from '../games/games.repository';
import { GamesService } from '../games/games.service';
import { GameWithCategory } from '../games/interfaces/game.interface';
import { SafeUser } from '../users/interfaces/user.interface';
import { GameAvailabilityService } from './game-availability.service';
import { GamePackagesRepository } from './game-packages.repository';
import { GamePackagesService } from './game-packages.service';
import { PackageStorageService } from './package-storage.service';
import { PackageValidationService } from './package-validation.service';

const makeGame = (overrides: Partial<GameWithCategory> = {}): GameWithCategory =>
  ({
    id: 'game-uuid',
    gameId: 'dragon-vault',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    category: { isActive: true },
    installedVersion: '1.1.0',
    publishedVersion: '1.0.0',
    packageStatus: 'INSTALLED',
    ...overrides,
  }) as unknown as GameWithCategory;

const makeVersion = (version: string, state: 'UPLOADED' | 'INSTALLED' = 'INSTALLED'): GameVersion =>
  ({ id: `v-${version}`, gameId: 'game-uuid', version, state, entryPoint: 'index.html' }) as unknown as GameVersion;

const admin = { id: 'admin-1', role: Role.ADMIN } as unknown as SafeUser;

describe('GameAvailabilityService', () => {
  let versions: Record<string, GameVersion | null>;
  let filesPresent: boolean;
  let game: GameWithCategory | null;
  let service: GameAvailabilityService;

  beforeEach(() => {
    game = makeGame();
    versions = { '1.0.0': makeVersion('1.0.0') };
    filesPresent = true;
    service = new GameAvailabilityService(
      { findByGameId: async () => game } as unknown as GamesRepository,
      { findVersionByNumber: async (_id: string, version: string) => versions[version] ?? null } as unknown as GamePackagesRepository,
      { isInstalled: async () => filesPresent } as unknown as PackageStorageService,
    );
  });

  const failed = async () => (await service.inspectGame(game as GameWithCategory)).checks.filter((c) => !c.passed).map((c) => c.id);

  it('is launchable only when every check passes, and returns the published version', async () => {
    const report = await service.inspectGame(makeGame());
    assert.equal(report.launchable, true);
    assert.equal(report.version?.version, '1.0.0');
    assert.deepEqual(await failed(), []);
    assert.equal((await service.getLaunchable('dragon-vault')).version.version, '1.0.0');
  });

  it('reports each failing reason', async () => {
    game = makeGame({ status: 'DISABLED' });
    assert.deepEqual(await failed(), ['enabled']);
    game = makeGame({ status: 'DRAFT' });
    assert.deepEqual(await failed(), ['enabled']);
    game = makeGame({ visibility: 'PRIVATE' });
    assert.deepEqual(await failed(), ['visible']);
    game = makeGame({ category: { isActive: false } as never });
    assert.deepEqual(await failed(), ['categoryActive']);
    game = makeGame({ publishedVersion: null });
    assert.deepEqual(await failed(), ['published', 'publishedVersionInstalled', 'filesPresent']);
    versions['1.0.0'] = makeVersion('1.0.0', 'UPLOADED');
    game = makeGame();
    assert.deepEqual(await failed(), ['publishedVersionInstalled', 'filesPresent']);
    versions['1.0.0'] = makeVersion('1.0.0');
    filesPresent = false;
    assert.deepEqual(await failed(), ['filesPresent']);
  });

  it('the launch check refuses exactly when the report says not launchable', async () => {
    for (const change of [{ status: 'DISABLED' }, { visibility: 'PRIVATE' }, { publishedVersion: null }, { publishedVersion: '9.9.9' }]) {
      game = makeGame(change as Partial<GameWithCategory>);
      const report = await service.inspectGame(game);
      assert.equal(report.launchable, false);
      await assert.rejects(service.getLaunchable('dragon-vault'), NotFoundException);
    }
    game = null;
    await assert.rejects(service.getLaunchable('nope'), NotFoundException);
  });
});

describe('GamePackagesService.uninstall', () => {
  let game: GameWithCategory;
  let store: Record<string, GameVersion>;
  let uninstalled: { versionId: string; wasInstalled: boolean; actor: string }[];
  let removedFiles: string[];
  let service: GamePackagesService;

  beforeEach(() => {
    game = makeGame({ installedVersion: '1.1.0', publishedVersion: '1.0.0' });
    store = { 'v-1.0.0': makeVersion('1.0.0'), 'v-1.1.0': makeVersion('1.1.0'), 'v-0.9.0': makeVersion('0.9.0', 'UPLOADED') };
    uninstalled = [];
    removedFiles = [];
    service = new GamePackagesService(
      { getById: async () => game } as unknown as GamesService,
      {
        findVersionById: async (_g: string, id: string) => store[id] ?? null,
        markUninstalled: async (version: GameVersion, wasInstalled: boolean, actor: string) => {
          uninstalled.push({ versionId: version.id, wasInstalled, actor });
          store[version.id] = { ...version, state: 'UPLOADED' } as GameVersion;
        },
      } as unknown as GamePackagesRepository,
      {} as PackageValidationService,
      { removeInstalled: async (_g: string, version: string) => void removedFiles.push(version) } as unknown as PackageStorageService,
      {} as GameAvailabilityService,
    );
  });

  it('removes the files of an installed version that players do not receive', async () => {
    const view = await service.uninstall('game-uuid', 'v-1.1.0', admin);
    assert.deepEqual(uninstalled, [{ versionId: 'v-1.1.0', wasInstalled: true, actor: 'admin-1' }]);
    assert.deepEqual(removedFiles, ['1.1.0']);
    assert.equal(view.state, 'UPLOADED');
  });

  it('knows when the version was not the game\'s current installed version', async () => {
    game = makeGame({ installedVersion: '1.1.0', publishedVersion: '1.1.0' });
    store['v-1.0.0'] = makeVersion('1.0.0'); // an older installed version, kept for rollback
    await service.uninstall('game-uuid', 'v-1.0.0', admin);
    assert.equal(uninstalled[0].wasInstalled, false);
  });

  it('refuses to uninstall the version players currently receive', async () => {
    await assert.rejects(service.uninstall('game-uuid', 'v-1.0.0', admin), ConflictException);
    assert.deepEqual(removedFiles, []);
    assert.equal(uninstalled.length, 0);
  });

  it('refuses a version that is not installed, and an unknown version', async () => {
    await assert.rejects(service.uninstall('game-uuid', 'v-0.9.0', admin), ConflictException);
    await assert.rejects(service.uninstall('game-uuid', 'v-missing', admin), NotFoundException);
  });
});
