import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { ENGINES_API_TAG, ENGINES_ROUTE, ENGINE_MESSAGES } from './constants/game-engine.constants';
import { EngineInfoResponseDto } from './dto/game-play-response.dto';
import { GameEngineRegistry } from './game-engine.registry';

@ApiTags(ENGINES_API_TAG)
@Controller(ENGINES_ROUTE)
@Auth()
export class GameEnginesController {
  constructor(private readonly registry: GameEngineRegistry) {}

  @Get()
  @ResponseMessage(ENGINE_MESSAGES.ENGINES_LISTED)
  @ApiOperation({
    summary: 'Game algorithms available on the server',
    description: 'For each game with an engine: its version and the bet limits and options a client needs.',
  })
  @ApiSuccessResponse(EngineInfoResponseDto, 'The engines (the data is an array of this object)')
  list(): { gameId: string; engineVersion: string; rules: Record<string, unknown> }[] {
    return this.registry.list().map((engine) => ({
      gameId: engine.gameId,
      engineVersion: engine.engineVersion,
      rules: engine.describeRules(),
    }));
  }
}
