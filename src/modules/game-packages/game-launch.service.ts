import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { durationToMs } from '../../common/utils/duration.util';
import { APP_CONFIG_KEY, AppConfig } from '../../config/app.config';
import { PACKAGES_CONFIG_KEY, PackagesConfig } from '../../config/packages.config';
import { AUTH_ERRORS } from '../auth/constants/auth.constants';
import { TokenService } from '../auth/token.service';
import { SafeUser } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { PACKAGE_ERRORS } from './constants/game-packages.constants';
import { GameAvailabilityService } from './game-availability.service';
import { LaunchInfo } from './interfaces/game-package.interface';
import { PackageStorageService } from './package-storage.service';

@Injectable()
export class GameLaunchService {
  private readonly launchExpiresIn: string;
  private readonly apiPrefix: string;

  constructor(
    configService: ConfigService,
    private readonly availability: GameAvailabilityService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
    private readonly storage: PackageStorageService,
  ) {
    this.launchExpiresIn = configService.getOrThrow<PackagesConfig>(PACKAGES_CONFIG_KEY).launchExpiresIn;
    this.apiPrefix = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY).apiPrefix;
  }

  /**
   * Creates a short-lived launch link for a game that is currently available. The link is bound to
   * the player and to the published version, so it stops working if the game is disabled,
   * unpublished, rolled back or the player is deactivated.
   */
  async launch(user: SafeUser, gameId: string): Promise<LaunchInfo> {
    const { game, version } = await this.availability.getLaunchable(gameId);
    const token = await this.tokenService.issueLaunchToken(
      { sub: user.id, gid: game.gameId, ver: version.version },
      this.launchExpiresIn,
    );

    return {
      gameId: game.gameId,
      version: version.version,
      entryPoint: version.entryPoint,
      playUrl: `/${this.apiPrefix}/play/${token}/`,
      expiresAt: new Date(Date.now() + durationToMs(this.launchExpiresIn)),
    };
  }

  /**
   * Resolves one file request from a running game. EVERY request repeats the full check
   * (token, active player, game still available, same version), so a package file can never
   * be reached once the game is unavailable, even with a previously valid link.
   */
  async resolvePlayFile(token: string, requestedPath: string): Promise<string> {
    const payload = await this.tokenService.verifyLaunchToken(token);

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);

    const { game, version } = await this.availability.getLaunchable(payload.gid);
    if (version.version !== payload.ver) throw new NotFoundException(PACKAGE_ERRORS.LAUNCH_EXPIRED);

    const file = await this.storage.resolveInstalledFile(
      game.gameId,
      version.version,
      requestedPath || version.entryPoint,
    );
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
