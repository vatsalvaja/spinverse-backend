import { GamePackageEvent, GameVersion } from '@prisma/client';
import { GameWithCategory } from '../../games/interfaces/game.interface';
import { PackageManifest, ValidationCheck } from './package-validation.interface';

/** The file part of a multipart upload (the platform's memory storage). */
export interface UploadedZipFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface CreateGameVersionData {
  /** Game row id (uuid), not the public game id. */
  gameId: string;
  version: string;
  releaseNotes?: string;
  fileName: string;
  storageKey: string;
  sizeBytes: number;
  unpackedBytes: number;
  fileCount: number;
  checksum: string;
  manifest: PackageManifest;
  entryPoint: string;
  validation: { checks: ValidationCheck[]; warnings: string[] };
  uploadedById: string;
}

/** A stored version plus where it currently sits in the lifecycle of its game. */
export interface GameVersionView extends GameVersion {
  /** This is the version currently installed for the game. */
  isInstalledVersion: boolean;
  /** This is the version players currently receive. */
  isPublishedVersion: boolean;
}

export type PackageEvent = GamePackageEvent;

/** A game that passed every availability check, together with the version players receive. */
export interface LaunchableGame {
  game: GameWithCategory;
  version: GameVersion;
}

export interface LaunchInfo {
  gameId: string;
  version: string;
  entryPoint: string;
  /** Path (below the API origin) of the game. Ends with `/`; open it in an iframe. */
  playUrl: string;
  expiresAt: Date;
}

export interface AvailabilityCheck {
  id: 'enabled' | 'visible' | 'categoryActive' | 'published' | 'publishedVersionInstalled' | 'filesPresent';
  label: string;
  passed: boolean;
  detail: string | null;
}

/** Why a game can or cannot be launched right now. */
export interface AvailabilityReport {
  /** True only when every check passes: this is exactly what the launch endpoint requires. */
  launchable: boolean;
  checks: AvailabilityCheck[];
  status: string;
  packageStatus: string;
  installedVersion: string | null;
  publishedVersion: string | null;
  /** The published, installed version players would receive (null when not launchable). */
  version: GameVersion | null;
}
