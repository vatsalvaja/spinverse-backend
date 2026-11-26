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

export class MasterRefDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

/** `GET /auth/me`: the user plus, for a CLIENT, its owning master. */
export class MeResponseDto extends UserResponseDto {
  @ApiProperty({ type: MasterRefDto, nullable: true, description: 'The master that owns this CLIENT account; null for every other role' })
  master: MasterRefDto | null;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto, description: 'Includes `role` and, for a CLIENT, `parentId`' })
  user: UserResponseDto;

  @ApiProperty({ type: MasterRefDto, nullable: true, description: 'The master that owns this CLIENT account; null for every other role' })
  master: MasterRefDto | null;

  @ApiProperty({ type: AuthTokensDto })
  tokens: AuthTokensDto;
}
