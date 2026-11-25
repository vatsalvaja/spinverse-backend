import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { toBoolean } from '../../../common/utils/normalize.util';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../constants/audit.constants';

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only actions by this administrator (user id)' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: Object.values(AUDIT_ACTIONS), description: 'Action type, e.g. USER_DEACTIVATED' })
  @IsOptional()
  @IsIn(Object.values(AUDIT_ACTIONS))
  action?: string;

  @ApiPropertyOptional({ enum: Object.values(AUDIT_RESOURCES) })
  @IsOptional()
  @IsIn(Object.values(AUDIT_RESOURCES))
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Id of the affected resource (user id, game id, ...)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  resourceId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'false = only refused or failed attempts' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  success?: boolean;

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
}
