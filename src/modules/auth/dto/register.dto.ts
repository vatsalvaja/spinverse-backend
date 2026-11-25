import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail, trimString } from '../../../common/utils/normalize.util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/auth.constants';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@example.com', description: 'Stored lower-cased' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Str0ngPassword',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'Must contain at least one letter and one number',
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;
}
