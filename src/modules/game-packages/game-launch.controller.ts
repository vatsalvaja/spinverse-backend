import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { buildErrorResponse } from '../../common/utils/response.util';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/interfaces/user.interface';
import { LAUNCH_API_TAG, PACKAGE_MESSAGES, PLAY_RESPONSE_HEADERS } from './constants/game-packages.constants';
import { LaunchResponseDto } from './dto/launch-response.dto';
import { GameLaunchService } from './game-launch.service';
import type { LaunchInfo } from './interfaces/game-package.interface';

/** Player-facing launch endpoints. */
@ApiTags(LAUNCH_API_TAG)
@Controller()
export class GameLaunchController {
  constructor(private readonly launchService: GameLaunchService) {}

  @Post('games/:gameId/launch')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(PACKAGE_MESSAGES.LAUNCHED)
  @ApiOperation({
    summary: 'Launch a game',
    description:
      'Works only for games that are enabled, published and installed. Returns a short-lived link ' +
      '(`playUrl`) to load in an iframe. Every file request through the link re-checks availability.',
  })
  @ApiSuccessResponse(LaunchResponseDto, 'Launch link')
  @ApiErrors(HttpStatus.NOT_FOUND)
  launch(@CurrentUser() user: SafeUser, @Param('gameId') gameId: string): Promise<LaunchInfo> {
    return this.launchService.launch(user, gameId.toLowerCase());
  }

  /**
   * Serves the files of a launched game. Public on purpose (an iframe cannot send an Authorization
   * header): the launch token in the URL is the credential, and it is re-verified on every request.
   */
  @Get('play/:token/{*path}')
  @ApiOperation({
    summary: 'Serve a file of a launched game',
    description:
      'Used by the browser while the game runs: `/play/<launch-token>/` returns the entry page and relative asset URLs resolve below it. ' +
      'Returns 404 once the game is disabled, unpublished or rolled back, and 401 when the link expired.',
  })
  @ApiParam({ name: 'token', description: 'Launch token from POST /games/:gameId/launch' })
  @ApiParam({ name: 'path', required: false, description: 'File path inside the package (empty = entry page)' })
  @ApiErrors(HttpStatus.NOT_FOUND)
  async play(
    @Param('token') token: string,
    @Param('path') path: string | string[] | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const requested = Array.isArray(path) ? path.join('/') : (path ?? '');
    const file = await this.launchService.resolvePlayFile(token, requested);

    res.set(PLAY_RESPONSE_HEADERS);
    await new Promise<void>((resolve) => {
      // dot-files inside the package are already refused by the storage service; "allow" here only stops the
      // check from tripping over a dot-folder in the storage root's own path.
      res.sendFile(file, { dotfiles: 'allow', cacheControl: false }, (error) => {
        if (error && !res.headersSent) {
          res.status(HttpStatus.NOT_FOUND).json(
            buildErrorResponse({ message: 'File not found', statusCode: HttpStatus.NOT_FOUND, path: res.req.originalUrl }),
          );
        }
        resolve();
      });
    });
  }
}
