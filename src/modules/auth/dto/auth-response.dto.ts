import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { BEARER_TOKEN_TYPE } from '../constants/auth.constants';

export class AuthTokensDto {
  @ApiProperty({ description: 'Short-lived JWT; send as `Authorization: Bearer <token>`' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived, single-use JWT; exchange it at POST /auth/refresh' })
  refreshToken: string;

  @ApiProperty({ example: BEARER_TOKEN_TYPE })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'Access-token lifetime in seconds', example: 900 })
  expiresIn: number;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens: AuthTokensDto;
}
