import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../../common/utils/normalize.util';
import { USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH } from '../constants/users.constants';

/** What a user may change on their own profile. Role, email and status are not editable here. */
export class UpdateProfileDto {
  @ApiProperty({
    example: 'Jane Doe',
    minLength: USER_NAME_MIN_LENGTH,
    maxLength: USER_NAME_MAX_LENGTH,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(USER_NAME_MIN_LENGTH)
  @MaxLength(USER_NAME_MAX_LENGTH)
  name: string;
}
