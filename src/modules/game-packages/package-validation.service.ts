import { posix } from 'node:path';
import { Injectable } from '@nestjs/common';
import { PACKAGE_CONTRACT, ZIP_LIMITS } from './constants/package-contract.constants';
import { ZipEntry } from './interfaces/zip.interface';
import {
  PackageManifest,
  PackageValidationResult,
  ValidationCheck,
  ValidationCheckId,
} from './interfaces/package-validation.interface';
import { readZip } from './utils/zip-reader.util';

const M = PACKAGE_CONTRACT.manifest;
const S = PACKAGE_CONTRACT.structure;
const FORBIDDEN_DIRS = new Set(S.forbiddenDirectories);
const FORBIDDEN_NAMES = new Set(S.forbiddenFileNames);
const FORBIDDEN_EXT = new Set(S.forbiddenExtensions);
const IGNORED_NAMES = new Set(S.ignoredFileNames);
const KNOWN_KEYS = new Set([...M.requiredFields, 'build']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.htm', '.json', '.txt', '.svg', '.xml', '.webmanifest']);

const SECRET_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, what: 'a private key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'an AWS access key ID' },
  {
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/"']+:[^\s@/"']+@/i,
    what: 'a database connection string with credentials',
  },
  {
    re: /^\s*(?:DB|DATABASE|MYSQL|POSTGRES|MONGO|REDIS|JWT|SECRET|PRIVATE)_?[A-Z_]*(?:PASSWORD|SECRET|KEY|TOKEN)\s*=\s*\S+/m,
    what: 'an environment-style secret assignment',
  },
];

const CHECK_LABELS: Record<ValidationCheckId, string> = {
  'zip-format': 'ZIP format',
  'package-size': 'Package size',
  'manifest-present': 'manifest.json present',
  'manifest-fields': 'Manifest fields',
  'game-id': 'Game ID',
  version: 'Version',
  'entry-html': 'Entry HTML',
  assets: 'Assets',
  structure: 'Package structure',
};
const CHECK_ORDER = Object.keys(CHECK_LABELS) as ValidationCheckId[];

interface Finding {
  check: ValidationCheckId;
  message: string;
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const mb = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} MB`;

/** Relative, forward-slash, no traversal, no drive letters. */
export function isSafeRelative(path: unknown): path is string {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  return !path.split('/').some((segment) => segment === '..' || segment === '' || segment === '.');
}

/**
 * Server-side validation of an uploaded package against the package contract. The rules are
 * the same ones the Package Builder applies when it creates the ZIP. This is a safety net, not
 * a security scanner: it cannot prove a bundle contains no authoritative game logic.
 */
@Injectable()
export class PackageValidationService {
  /** `expectedGameId` is the Game ID of the game the package is being uploaded for. */
  validate(zip: Buffer, expectedGameId: string): PackageValidationResult {
    const errors: Finding[] = [];
    const warnings: Finding[] = [];
    const error = (check: ValidationCheckId, message: string) => errors.push({ check, message });
    const warn = (check: ValidationCheckId, message: string) => warnings.push({ check, message });

    if (zip.length > PACKAGE_CONTRACT.maxPackageBytes) {
      error('package-size', `The ZIP is ${mb(zip.length)}; the limit is ${mb(PACKAGE_CONTRACT.maxPackageBytes)}.`);
      return this.finish(errors, warnings, null, 0, 0);
    }

    const archive = readZip(zip, {
      maxEntries: ZIP_LIMITS.maxEntries,
      maxTotalBytes: PACKAGE_CONTRACT.maxPackageBytes,
    });
    archive.errors.forEach((message) => error('zip-format', message));
    if (archive.errors.length > 0 && archive.entries.length === 0) {
      return this.finish(errors, warnings, null, 0, 0);
    }

    // Every entry must inflate and match its CRC, one at a time so memory stays low.
    for (const entry of archive.entries) {
      try {
        entry.read();
      } catch (cause) {
        error('zip-format', cause instanceof Error ? cause.message : `"${entry.path}" is corrupt.`);
      }
    }

    const files = archive.entries.filter((entry) => {
      const base = entry.path.split('/').pop() ?? '';
      return !IGNORED_NAMES.has(base);
    });
    const byPath = new Map(files.map((file) => [file.path, file]));
    const unpackedBytes = files.reduce((sum, file) => sum + file.size, 0);

    const manifest = this.readManifest(byPath, error);
    if (manifest) this.checkManifest(manifest, expectedGameId, error, warn);

    this.checkStructure(files, error);
    if (unpackedBytes > PACKAGE_CONTRACT.maxPackageBytes) {
      error('package-size', `Unpacked size ${mb(unpackedBytes)} exceeds the ${mb(PACKAGE_CONTRACT.maxPackageBytes)} limit.`);
    } else if (unpackedBytes > PACKAGE_CONTRACT.warnPackageBytes) {
      warn('package-size', `Unpacked size ${mb(unpackedBytes)} is large. Players download this on first install.`);
    }

    if (manifest) {
      this.checkEntryHtml(manifest, byPath, error, warn);
      this.checkAssets(manifest, files, byPath, error);
    }
    this.scanTextFiles(files, error);

    return this.finish(errors, warnings, errors.length === 0 ? manifest : null, files.length, unpackedBytes);
  }

  private readManifest(
    byPath: Map<string, ZipEntry>,
    error: (check: ValidationCheckId, message: string) => void,
  ): PackageManifest | null {
    const entry = byPath.get(M.fileName);
    if (!entry) {
      error('manifest-present', `${M.fileName} is missing from the package root.`);
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(entry.read().toString('utf8'));
      if (!isObject(parsed)) {
        error('manifest-fields', `${M.fileName} must contain a JSON object.`);
        return null;
      }
      return parsed as PackageManifest;
    } catch {
      error('manifest-fields', `${M.fileName} is not valid JSON.`);
      return null;
    }
  }

  private checkManifest(
    manifest: PackageManifest,
    expectedGameId: string,
    error: (check: ValidationCheckId, message: string) => void,
    warn: (check: ValidationCheckId, message: string) => void,
  ): void {
    const raw = manifest as Record<string, unknown>;

    for (const field of M.requiredFields) {
      if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
        error('manifest-fields', `manifest.json is missing the required field "${field}".`);
      }
    }

    if (raw.gameId !== undefined) {
      const id = raw.gameId;
      if (
        typeof id !== 'string' ||
        id.length < M.gameIdMinLength ||
        id.length > M.gameIdMaxLength ||
        !M.gameIdPattern.test(id)
      ) {
        error(
          'game-id',
          `gameId must be ${M.gameIdMinLength}-${M.gameIdMaxLength} characters: lowercase letters, numbers and single hyphens.`,
        );
      } else if (id !== expectedGameId) {
        error('game-id', `gameId "${id}" does not match this game ("${expectedGameId}"). The Game ID is permanent.`);
      }
    }
    if (raw.name !== undefined && !isString(raw.name)) error('manifest-fields', '"name" must be a non-empty string.');
    if (raw.version !== undefined && (typeof raw.version !== 'string' || !M.versionPattern.test(raw.version))) {
      error('version', '"version" must look like 1.0.0 (MAJOR.MINOR.PATCH).');
    }
    if (raw.description !== undefined) {
      if (!isString(raw.description)) error('manifest-fields', '"description" must be a non-empty string.');
      else if (raw.description.length > M.descriptionMaxLength) {
        error('manifest-fields', `"description" is ${raw.description.length} characters; the limit is ${M.descriptionMaxLength}.`);
      }
    }
    if (raw.entryPoint !== undefined) {
      if (!isSafeRelative(raw.entryPoint)) {
        error('entry-html', '"entryPoint" must be a relative path inside the package, for example "index.html".');
      } else if (!/\.html?$/.test(raw.entryPoint)) {
        error('entry-html', '"entryPoint" must point to an HTML file.');
      }
    }

    if (raw.assets !== undefined) {
      const assets = raw.assets;
      if (!isObject(assets)) {
        error('assets', '"assets" must be an object.');
      } else {
        const thumbnail = assets.thumbnail;
        if (!isString(thumbnail) || !isSafeRelative(thumbnail)) {
          error('assets', '"assets.thumbnail" must be a relative path to an image, for example "assets/thumbnail.webp".');
        } else if (!M.thumbnailExtensions.includes(posix.extname(thumbnail).toLowerCase())) {
          error('assets', `"assets.thumbnail" must be one of: ${M.thumbnailExtensions.join(', ')}.`);
        }
        for (const key of ['images', 'audio']) {
          const value = assets[key];
          if (value === undefined) continue;
          if (!isString(value) || !value.endsWith('/') || !isSafeRelative(value.replace(/\/$/, ''))) {
            error('assets', `"assets.${key}" must be a relative folder path ending in "/", for example "assets/${key}/".`);
          }
        }
      }
    }

    if (raw.compatibility !== undefined) {
      const compat = raw.compatibility;
      if (!isObject(compat)) {
        error('manifest-fields', '"compatibility" must be an object.');
      } else {
        if (!isString(compat.minBrowser)) error('manifest-fields', '"compatibility.minBrowser" is required, for example "Chrome 110".');
        const platforms = compat.platforms;
        if (!Array.isArray(platforms) || platforms.length === 0) {
          error('manifest-fields', '"compatibility.platforms" must list at least one platform.');
        } else {
          const unknown = platforms.filter((platform) => !M.platforms.includes(String(platform)));
          if (unknown.length > 0) {
            error('manifest-fields', `"compatibility.platforms" has unknown value(s): ${unknown.join(', ')}. Allowed: ${M.platforms.join(', ')}.`);
          }
        }
        if (!M.orientations.includes(String(compat.orientation))) {
          error('manifest-fields', `"compatibility.orientation" must be one of: ${M.orientations.join(', ')}.`);
        }
        const minClient = compat.minClientVersion;
        if (minClient !== undefined && !(typeof minClient === 'string' && M.versionPattern.test(minClient))) {
          error('manifest-fields', '"compatibility.minClientVersion" (optional) must look like 1.0.0.');
        }
      }
    }

    for (const key of Object.keys(raw)) {
      if (!KNOWN_KEYS.has(key)) warn('manifest-fields', `Unknown manifest field "${key}" is ignored by the platform.`);
    }
  }

  private checkStructure(files: ZipEntry[], error: (check: ValidationCheckId, message: string) => void): void {
    for (const file of files) {
      if (!isSafeRelative(file.path)) {
        error('structure', `Unsafe path in package: "${file.path}".`);
        continue;
      }
      const segments = file.path.split('/');
      const base = segments[segments.length - 1];
      const forbiddenDir = segments.slice(0, -1).find((segment) => FORBIDDEN_DIRS.has(segment));
      const ext = posix.extname(base).toLowerCase();
      if (forbiddenDir) {
        error('structure', `Forbidden folder "${forbiddenDir}/" in package: ${file.path}. Packages must be a static frontend build only.`);
      } else if (FORBIDDEN_NAMES.has(base) || S.forbiddenFilePrefixes.some((prefix) => base.startsWith(prefix))) {
        error('structure', `Forbidden file in package: ${file.path}.`);
      } else if (FORBIDDEN_EXT.has(ext)) {
        error('structure', `Forbidden file type "${ext}" in package: ${file.path}. Source files, source maps, keys, server-side code and temporary files must not ship.`);
      }
    }
  }

  private checkEntryHtml(
    manifest: PackageManifest,
    byPath: Map<string, ZipEntry>,
    error: (check: ValidationCheckId, message: string) => void,
    warn: (check: ValidationCheckId, message: string) => void,
  ): void {
    if (!isSafeRelative(manifest.entryPoint)) return; // already reported
    const entry = byPath.get(manifest.entryPoint);
    if (!entry) {
      error('entry-html', `entryPoint "${manifest.entryPoint}" was not found in the package.`);
      return;
    }
    if (entry.size > ZIP_LIMITS.scanMaxBytes) return;

    const html = this.safeRead(entry);
    const dir = posix.dirname(entry.path);
    const reported = new Set<string>();
    const pattern = /\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
      const ref = (match[1] ?? match[2]).trim();
      if (!ref || ref.startsWith('#') || /^(?:data|blob|mailto|tel|javascript):/i.test(ref)) continue;
      if (/^(?:https?:)?\/\//i.test(ref)) {
        if (!reported.has(ref)) warn('entry-html', `${entry.path} loads an external resource (${ref}). The game will not work offline.`);
        reported.add(ref);
        continue;
      }
      if (ref.startsWith('/')) {
        error('entry-html', `${entry.path} uses the root-absolute path "${ref}". Use relative paths so the game works from any location.`);
        continue;
      }
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      const target = posix.normalize(posix.join(dir, clean));
      if (target.startsWith('../')) error('entry-html', `${entry.path} references "${ref}" outside the package.`);
      else if (!byPath.has(target)) error('entry-html', `${entry.path} references "${ref}" but "${target}" is not in the package.`);
    }
  }

  private checkAssets(
    manifest: PackageManifest,
    files: ZipEntry[],
    byPath: Map<string, ZipEntry>,
    error: (check: ValidationCheckId, message: string) => void,
  ): void {
    const assets: Record<string, unknown> = isObject(manifest.assets) ? manifest.assets : {};
    if (isString(assets.thumbnail) && !byPath.has(assets.thumbnail)) {
      error('assets', `assets.thumbnail "${assets.thumbnail}" was not found in the package.`);
    }
    for (const key of ['images', 'audio'] as const) {
      const folder = assets[key];
      if (isString(folder) && !files.some((file) => file.path.startsWith(folder))) {
        error('assets', `assets.${key} "${folder}" is empty or missing in the package.`);
      }
    }
  }

  /** Root-absolute URLs in CSS/JS and a best-effort secret scan of text files. */
  private scanTextFiles(files: ZipEntry[], error: (check: ValidationCheckId, message: string) => void): void {
    for (const file of files) {
      const ext = posix.extname(file.path).toLowerCase();
      if (!TEXT_EXT.has(ext) || file.size > ZIP_LIMITS.scanMaxBytes) continue;
      const text = this.safeRead(file);

      if (ext === '.css') {
        const absolute = /url\(\s*["']?\/(?!\/)([^)"']*)/.exec(text);
        if (absolute) error('structure', `${file.path} uses a root-absolute url("/${absolute[1]}"). Use relative asset URLs.`);
      }
      if (ext === '.js' || ext === '.mjs') {
        const absolute = /["'`]\/(?:art|audio|images|img|fonts|assets|sounds|sfx|media)\/[A-Za-z0-9_.-]+/.exec(text);
        if (absolute) error('structure', `${file.path} contains the root-absolute asset URL ${absolute[0].slice(1)}... Asset URLs must stay relative to the package.`);
      }
      for (const { re, what } of SECRET_PATTERNS) {
        if (re.test(text)) {
          error('structure', `${file.path} appears to contain ${what}. Remove it: packages are public frontend code.`);
          break;
        }
      }
    }
  }

  private safeRead(entry: ZipEntry): string {
    try {
      return entry.read().toString('utf8');
    } catch {
      return ''; // corruption is already reported by the integrity pass
    }
  }

  private finish(
    errors: Finding[],
    warnings: Finding[],
    manifest: PackageManifest | null,
    fileCount: number,
    unpackedBytes: number,
  ): PackageValidationResult {
    const checks: ValidationCheck[] = CHECK_ORDER.map((id) => {
      const failed = errors.find((finding) => finding.check === id);
      const warned = warnings.find((finding) => finding.check === id);
      return {
        id,
        label: CHECK_LABELS[id],
        state: failed ? 'failed' : warned ? 'warning' : 'passed',
        detail: failed?.message ?? warned?.message ?? null,
      };
    });
    return {
      valid: errors.length === 0,
      errors: errors.map((finding) => finding.message),
      warnings: warnings.map((finding) => finding.message),
      checks,
      manifest,
      fileCount,
      unpackedBytes,
    };
  }
}
