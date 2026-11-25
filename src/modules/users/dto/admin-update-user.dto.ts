import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { Role } from '../../../common/enums/role.enum';
import { normalizeEmail, trimString } from '../../../common/utils/normalize.util';
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_NAME_MIN_LENGTH,
} from '../constants/users.constants';

/** Admin edit of another account. Send only the fields to change. */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @OptionalNotNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(USER_NAME_MIN_LENGTH)
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', description: 'Stored lower-cased' })
  @OptionalNotNull()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'Admins cannot change their own role',
  })
  @OptionalNotNull()
  @IsEnum(Role)
  role?: Role;
}
