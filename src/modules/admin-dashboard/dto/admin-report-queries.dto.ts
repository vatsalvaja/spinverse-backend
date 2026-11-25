import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { normalizeSlug } from '../../../common/utils/normalize.util';
import { DateRangeQueryDto } from '../../game-history/dto/game-history-queries.dto';

/** Daily report filters: a date range (default: the last 30 days, at most 366 days) and optionally one game. */
export class DailyReportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Only rounds of this game (public game id). New users and wallet totals are not game-specific.' })
  @IsOptional()
  @Transform(normalizeSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  gameId?: string;
}
