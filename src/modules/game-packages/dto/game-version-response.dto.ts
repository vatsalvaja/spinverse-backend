import { ApiProperty } from '@nestjs/swagger';
import { GameVersionState } from '../enums/game-version-state.enum';
import { PackageEventType } from '../enums/package-event-type.enum';

export class ValidationCheckDto {
  @ApiProperty({ example: 'manifest-present' })
  id: string;

  @ApiProperty({ example: 'manifest.json present' })
  label: string;

  @ApiProperty({ enum: ['passed', 'failed', 'warning'] })
  state: string;

  @ApiProperty({ type: String, nullable: true })
  detail: string | null;
}

export class PackageValidationDto {
  @ApiProperty({ type: [ValidationCheckDto] })
  checks: ValidationCheckDto[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}

export class GameVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Id (uuid) of the game this version belongs to' })
  gameId: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiProperty({ type: String, nullable: true })
  releaseNotes: string | null;

  @ApiProperty({ example: 'dragon-vault-v1.0.0.zip' })
  fileName: string;

  @ApiProperty({ description: 'Size of the ZIP in bytes' })
  sizeBytes: number;

  @ApiProperty({ description: 'Total size of the files inside, in bytes' })
  unpackedBytes: number;

  @ApiProperty()
  fileCount: number;

  @ApiProperty({ description: 'SHA-256 of the ZIP (hex)' })
  checksum: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The manifest.json shipped in the package' })
  manifest: Record<string, unknown>;

  @ApiProperty({ example: 'index.html' })
  entryPoint: string;

  @ApiProperty({ type: PackageValidationDto })
  validation: PackageValidationDto;

  @ApiProperty({ enum: GameVersionState })
  state: GameVersionState;

  @ApiProperty({ description: 'This is the version currently installed for the game' })
  isInstalledVersion: boolean;

  @ApiProperty({ description: 'This is the version players currently receive' })
  isPublishedVersion: boolean;

  @ApiProperty({ type: String, nullable: true })
  uploadedById: string | null;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  installedAt: Date | null;
}

export class PackageEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  gameId: string;

  @ApiProperty({ type: String, nullable: true })
  versionId: string | null;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiProperty({ enum: PackageEventType })
  type: PackageEventType;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: String, nullable: true })
  actorId: string | null;

  @ApiProperty()
  createdAt: Date;
}

class AvailabilityCheckDto {
  @ApiProperty({ example: 'published' })
  id: string;

  @ApiProperty({ example: 'A version is published' })
  label: string;

  @ApiProperty()
  passed: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Why the check failed' })
  detail: string | null;
}

export class AvailabilityResponseDto {
  @ApiProperty({ description: 'True only when every check passes: exactly what the launch endpoint requires' })
  launchable: boolean;

  @ApiProperty({ type: [AvailabilityCheckDto] })
  checks: AvailabilityCheckDto[];

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 'INSTALLED' })
  packageStatus: string;

  @ApiProperty({ type: String, nullable: true })
  installedVersion: string | null;

  @ApiProperty({ type: String, nullable: true })
  publishedVersion: string | null;
}
