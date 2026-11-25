import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SEMVER_PATTERN, SLUG_PATTERN } from '../../common/constants/validation.constants';
import { PACKAGES_CONFIG_KEY, PackagesConfig } from '../../config/packages.config';
import { ZipEntry } from './interfaces/zip.interface';
import { isSafeRelative } from './package-validation.service';

const ZIP_NAME = 'package.zip';
const INSTALL_DIR = 'files';

/**
 * Everything that touches the package files on disk. Layout, below the storage root:
 *
 *   <gameId>/<version>/package.zip   the stored upload
 *   <gameId>/<version>/files/...     the unpacked, installed package
 *
 * The root is never served directly: players only reach `files/` through the launch endpoint,
 * which checks availability on every request.
 */
@Injectable()
export class PackageStorageService {
  private readonly root: string;

  constructor(configService: ConfigService) {
    this.root = configService.getOrThrow<PackagesConfig>(PACKAGES_CONFIG_KEY).storageDir;
  }

  zipKey(gameId: string, version: string): string {
    return `${this.safeId(gameId)}/${this.safeVersion(version)}/${ZIP_NAME}`;
  }

  /** Stores the uploaded ZIP. Fails if this version already has a file. */
  async saveZip(gameId: string, version: string, data: Buffer): Promise<string> {
    const key = this.zipKey(gameId, version);
    const target = this.within(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
    return key;
  }

  readZip(storageKey: string): Promise<Buffer> {
    return readFile(this.within(this.root, storageKey));
  }

  /** Removes everything stored for a version (used to undo a failed upload). */
  async removeVersion(gameId: string, version: string): Promise<void> {
    await rm(this.versionDir(gameId, version), { recursive: true, force: true });
  }

  /**
   * Unpacks a verified archive into `files/`. Writes to a temporary folder first and swaps it in,
   * so a failure never leaves a half-installed package behind.
   */
  async extract(gameId: string, version: string, entries: ZipEntry[]): Promise<void> {
    const versionDir = this.versionDir(gameId, version);
    const tmp = `${versionDir}${sep}${INSTALL_DIR}.tmp-${randomBytes(6).toString('hex')}`;
    const target = `${versionDir}${sep}${INSTALL_DIR}`;

    try {
      for (const entry of entries) {
        if (!isSafeRelative(entry.path)) throw new Error(`Unsafe path "${entry.path}"`);
        const file = this.within(tmp, entry.path);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, entry.read(), { flag: 'wx' });
      }
      await rm(target, { recursive: true, force: true });
      await rename(tmp, target);
    } catch (error) {
      await rm(tmp, { recursive: true, force: true });
      throw error;
    }
  }

  /** Deletes the unpacked files of a version (the stored ZIP stays, so it can be installed again). */
  async removeInstalled(gameId: string, version: string): Promise<void> {
    await rm(`${this.versionDir(gameId, version)}${sep}${INSTALL_DIR}`, { recursive: true, force: true });
  }

  async isInstalled(gameId: string, version: string): Promise<boolean> {
    try {
      return (await stat(`${this.versionDir(gameId, version)}${sep}${INSTALL_DIR}`)).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Absolute path of a file inside an installed package, or null when it does not exist, is not a
   * regular file, would escape the package folder, or is a hidden (dot) file.
   */
  async resolveInstalledFile(gameId: string, version: string, relativePath: string): Promise<string | null> {
    // Dot-files are refused, and ":" is refused so a Windows drive-style segment ("a/c:x") cannot leave the folder.
    if (
      !isSafeRelative(relativePath) ||
      relativePath.split('/').some((segment) => segment.startsWith('.') || segment.includes(':'))
    ) {
      return null;
    }
    const base = `${this.versionDir(gameId, version)}${sep}${INSTALL_DIR}`;
    try {
      const target = this.within(base, relativePath);
      return (await stat(target)).isFile() ? target : null;
    } catch {
      return null;
    }
  }

  private versionDir(gameId: string, version: string): string {
    return this.within(this.root, `${this.safeId(gameId)}/${this.safeVersion(version)}`);
  }

  private safeId(gameId: string): string {
    if (!SLUG_PATTERN.test(gameId)) throw new Error(`Unsafe game id "${gameId}"`);
    return gameId;
  }

  private safeVersion(version: string): string {
    if (!SEMVER_PATTERN.test(version)) throw new Error(`Unsafe version "${version}"`);
    return version;
  }

  /** Joins `relative` onto `base` and guarantees the result stays inside `base`. */
  private within(base: string, relative: string): string {
    const baseResolved = resolve(base);
    const target = resolve(baseResolved, ...relative.split('/'));
    if (target !== baseResolved && !target.startsWith(baseResolved + sep)) {
      throw new Error('Path escapes the storage folder');
    }
    return target;
  }
}
