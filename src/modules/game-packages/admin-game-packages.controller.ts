import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GameResponseDto } from '../games/dto/game-response.dto';
import type { GameWithCategory } from '../games/interfaces/game.interface';
import type { SafeUser } from '../users/interfaces/user.interface';
import {
  ADMIN_PACKAGES_API_TAG,
  ADMIN_PACKAGES_ROUTE,
  PACKAGE_MESSAGES,
} from './constants/game-packages.constants';
import { PACKAGE_CONTRACT } from './constants/package-contract.constants';
import { AvailabilityResponseDto, GameVersionResponseDto, PackageEventResponseDto } from './dto/game-version-response.dto';
import { Audit } from '../audit/decorators/audit.decorator';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { RollbackDto } from './dto/rollback.dto';
import { UploadVersionDto } from './dto/upload-version.dto';
import { GamePackagesService } from './game-packages.service';
import type { AvailabilityReport, GameVersionView, PackageEvent, UploadedZipFile } from './interfaces/game-package.interface';

/** Keeps only the version facts in the audit entry (never the whole package record). */
const summarizeVersion = (result: unknown): Record<string, unknown> => {
  const version = result as { id?: string; version?: string; checksum?: string };
  return { versionId: version.id, version: version.version, checksum: version.checksum };
};

/**
 * Package lifecycle for a game (`:id` is the game's UUID). Every route requires the ADMIN role.
 *
 *   upload  ->  install  ->  publish          (and unpublish / rollback)
 *   Enabling and disabling the game itself uses PATCH /admin/games/:id/enable and /disable.
 */
@ApiTags(ADMIN_PACKAGES_API_TAG)
@Controller(ADMIN_PACKAGES_ROUTE)
@Auth(Role.ADMIN)
export class AdminGamePackagesController {
  constructor(private readonly packagesService: GamePackagesService) {}

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PACKAGE_CONTRACT.maxPackageBytes } }))
  @ResponseMessage(PACKAGE_MESSAGES.UPLOADED)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_UPLOADED, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id', summarize: summarizeVersion })
  @ApiOperation({
    summary: 'Upload a game package (ZIP)',
    description:
      'Validates the ZIP against the package contract (manifest, game id, version, entry HTML, assets, structure, size) ' +
      'and stores it as a new, not yet installed version. Versions are permanent: a version number can be uploaded only once. ' +
      'An invalid package is rejected with 422 and a list of problems; nothing is stored.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'The package ZIP (max 250 MB)' },
        releaseNotes: { type: 'string', maxLength: 1000 },
      },
    },
  })
  @ApiSuccessResponse(GameVersionResponseDto, 'Version stored', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY)
  upload(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedZipFile | undefined,
    @Body() dto: UploadVersionDto,
  ): Promise<GameVersionView> {
    return this.packagesService.upload(id, file, dto, actor);
  }

  @Get(':id/versions')
  @ResponseMessage(PACKAGE_MESSAGES.LISTED)
  @ApiOperation({ summary: 'Package version history of a game (newest first)' })
  @ApiSuccessResponse(GameVersionResponseDto, 'Versions (the data is an array of this object)')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  list(@Param('id', ParseUUIDPipe) id: string): Promise<GameVersionView[]> {
    return this.packagesService.listVersions(id);
  }

  @Get(':id/versions/:versionId')
  @ResponseMessage(PACKAGE_MESSAGES.FETCHED)
  @ApiOperation({ summary: 'One package version' })
  @ApiSuccessResponse(GameVersionResponseDto, 'The version')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<GameVersionView> {
    return this.packagesService.getVersion(id, versionId);
  }

  @Post(':id/versions/:versionId/install')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.INSTALLED)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_INSTALLED, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id', summarize: summarizeVersion })
  @ApiOperation({
    summary: 'Install a version',
    description:
      'Unpacks the stored package on the server (after re-checking its checksum) and makes it the game\'s installed version. ' +
      'Players are not affected until you publish.',
  })
  @ApiSuccessResponse(GameVersionResponseDto, 'The installed version')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT, HttpStatus.UNPROCESSABLE_ENTITY)
  install(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<GameVersionView> {
    return this.packagesService.install(id, versionId, actor);
  }

  @Post(':id/versions/:versionId/uninstall')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.UNINSTALLED)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_UNINSTALLED, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id', summarize: summarizeVersion })
  @ApiOperation({
    summary: 'Uninstall a version',
    description:
      'Deletes the unpacked files of an installed version (the stored ZIP stays and can be installed again). ' +
      'A version that players currently receive cannot be uninstalled: unpublish the game first.',
  })
  @ApiSuccessResponse(GameVersionResponseDto, 'The version, back in the UPLOADED state')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  uninstall(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<GameVersionView> {
    return this.packagesService.uninstall(id, versionId, actor);
  }

  @Get(':id/availability')
  @ResponseMessage(PACKAGE_MESSAGES.AVAILABILITY)
  @ApiOperation({
    summary: 'Is this game launchable right now?',
    description:
      'Runs the same checks as the launch endpoint (enabled, not private, category active, a version published, ' +
      'that version installed, files present) and shows which ones fail.',
  })
  @ApiSuccessResponse(AvailabilityResponseDto, 'The availability report')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  availability(@Param('id', ParseUUIDPipe) id: string): Promise<AvailabilityReport> {
    return this.packagesService.getAvailability(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.PUBLISHED)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_PUBLISHED, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id' })
  @ApiOperation({
    summary: 'Publish the installed version',
    description:
      'Players receive the installed version. The game is launchable only when it is also enabled (ACTIVE).',
  })
  @ApiSuccessResponse(GameResponseDto, 'The game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  publish(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameWithCategory> {
    return this.packagesService.publish(id, actor);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.UNPUBLISHED)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_UNPUBLISHED, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id' })
  @ApiOperation({
    summary: 'Unpublish the game',
    description: 'The game can no longer be launched and existing launch links stop working. Installed files are kept.',
  })
  @ApiSuccessResponse(GameResponseDto, 'The game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  unpublish(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameWithCategory> {
    return this.packagesService.unpublish(id, actor);
  }

  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.ROLLED_BACK)
  @Audit({ action: AUDIT_ACTIONS.PACKAGE_ROLLED_BACK, resourceType: AUDIT_RESOURCES.GAME_PACKAGE, targetParam: 'id' })
  @ApiOperation({
    summary: 'Roll back to a previously installed version',
    description:
      'Switches the installed version. If the game is published, players move to that version immediately and old launch links stop working.',
  })
  @ApiSuccessResponse(GameResponseDto, 'The game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  rollback(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackDto,
  ): Promise<GameWithCategory> {
    return this.packagesService.rollback(id, dto.versionId, actor);
  }

  @Get(':id/package-events')
  @ResponseMessage(PACKAGE_MESSAGES.EVENTS)
  @ApiOperation({ summary: 'Package history: uploads, installs, publishes, unpublishes and rollbacks' })
  @ApiPaginatedResponse(PackageEventResponseDto, 'Paginated history (newest first)')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<PackageEvent>> {
    return this.packagesService.listEvents(id, query);
  }
}
