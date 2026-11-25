import { ApiProperty } from '@nestjs/swagger';

export class LaunchResponseDto {
  @ApiProperty({ example: 'pharaohs-fortune' })
  gameId: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiProperty({ example: 'index.html' })
  entryPoint: string;

  @ApiProperty({
    example: '/api/v1/play/<launch-token>/',
    description: 'Path below the API origin. It ends with "/": load it in an iframe.',
  })
  playUrl: string;

  @ApiProperty({ description: 'When the link stops working' })
  expiresAt: Date;
}
