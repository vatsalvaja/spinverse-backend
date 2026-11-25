import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for both `POST /auth/refresh` and `POST /auth/logout`. */
export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued at login or by the last refresh' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  refreshToken: string;
}
