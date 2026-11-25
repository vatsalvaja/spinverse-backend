import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { normalizeSlug } from '../../../common/utils/normalize.util';
import { GameRoundStatusEnum } from '../enums/game-round-status.enum';

export class ListAdminRoundsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Public game id, e.g. roulette' })
  @IsOptional()
  @Transform(normalizeSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  gameId?: string;

  @ApiPropertyOptional({ description: 'Player user id' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: GameRoundStatusEnum })
  @IsOptional()
  @IsEnum(GameRoundStatusEnum)
  status?: GameRoundStatusEnum;
}
