import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH } from '../../../common/constants/validation.constants';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Role } from '../../../common/enums/role.enum';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { toBoolean, trimString } from '../../../common/utils/normalize.util';
import { UserSortField } from '../enums/user-sort-field.enum';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name or email' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter by account status', type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: UserSortField, default: UserSortField.CreatedAt })
  @IsOptional()
  @IsEnum(UserSortField)
  sortBy: UserSortField = UserSortField.CreatedAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.Desc;
}
