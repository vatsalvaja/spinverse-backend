import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { normalizeEmail, trimString } from '../../../common/utils/normalize.util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../auth/constants/auth.constants';
import { RegisterDto } from '../../auth/dto/register.dto';
import { USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH } from '../constants/users.constants';
import { ListUsersQueryDto } from './list-users-query.dto';

/**
 * Create a Master (Super Admin) or a Client (Master): name, e-mail and an initial password.
 *
 * The role and the parent are never part of the body. The role is fixed by the endpoint and a client's `parentId` is
 * always the authenticated master. Because the global ValidationPipe uses `forbidNonWhitelisted`, a body that tries
 * to send `role` or `parentId` is rejected with 400.
 */
export class CreateManagedAccountDto extends RegisterDto {}

/** Update a managed account. Send only the fields to change. */
export class UpdateManagedAccountDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @OptionalNotNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(USER_NAME_MIN_LENGTH)
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', description: 'Stored lower-cased; must not be used by another account' })
  @OptionalNotNull()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH, description: 'Resets the password. At least one letter and one number.' })
  @OptionalNotNull()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain at least one letter and one number' })
  password?: string;
}

/** Search / filter / sort / paginate a list of managed accounts (role and owner are fixed by the endpoint). */
export class ListManagedAccountsQueryDto extends OmitType(ListUsersQueryDto, ['role'] as const) {}

/** The Super Admin's system-wide user list: the usual filters plus the owning master. */
export class SuperAdminListUsersQueryDto extends ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Only the clients of this master (user id)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

