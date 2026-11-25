import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/normalize.util';
import { PASSWORD_MAX_LENGTH } from '../constants/auth.constants';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Str0ngPassword' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
