import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { normalizeSlug } from '../../../common/utils/normalize.util';
import { GameRoundStatusEnum } from '../../game-engine/enums/game-round-status.enum';
import { REPORT_DEFAULT_LIMIT, REPORT_MAX_LIMIT } from '../constants/game-history.constants';
import { GameHistorySortField } from '../enums/game-history-sort-field.enum';
import { RoundOutcome } from '../enums/round-outcome.enum';
import { UserActivitySortField } from '../enums/user-activity-sort-field.enum';

/** A date range on the round's start time (ISO 8601). */
export class DateRangeQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Rounds started at or after this time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Rounds started at or before this time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

/** Filters for a player's own history. */
export class ListGameHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only this game (public game id, e.g. roulette)' })
  @IsOptional()
  @Transform(normalizeSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  gameId?: string;

  @ApiPropertyOptional({ enum: GameRoundStatusEnum, description: 'IN_PROGRESS (still open) or SETTLED (completed)' })
  @IsOptional()
  @IsEnum(GameRoundStatusEnum)
  status?: GameRoundStatusEnum;

  @ApiPropertyOptional({ enum: RoundOutcome, description: 'Only settled rounds: WIN (paid more than staked), LOSS, or EVEN' })
  @IsOptional()
  @IsEnum(RoundOutcome)
  outcome?: RoundOutcome;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: GameHistorySortField, default: GameHistorySortField.StartedAt })
  @IsOptional()
  @IsEnum(GameHistorySortField)
  sortBy: GameHistorySortField = GameHistorySortField.StartedAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.Desc;
}

/** Admin filters: a player's filters plus a user. */
export class AdminListGameHistoryQueryDto extends ListGameHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Only this player (user id)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

/** Statistics filters (player: own rounds only). */
export class GameHistoryStatsQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Only this game (public game id)' })
  @IsOptional()
  @Transform(normalizeSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  gameId?: string;
}

export class AdminGameHistoryStatsQueryDto extends GameHistoryStatsQueryDto {
  @ApiPropertyOptional({ description: 'Only this player (user id)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

/** "Top N players" report. */
export class UserActivityQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: UserActivitySortField, default: UserActivitySortField.Rounds })
  @IsOptional()
  @IsEnum(UserActivitySortField)
  sortBy: UserActivitySortField = UserActivitySortField.Rounds;

  @ApiPropertyOptional({ minimum: 1, maximum: REPORT_MAX_LIMIT, default: REPORT_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_MAX_LIMIT)
  limit: number = REPORT_DEFAULT_LIMIT;
}
