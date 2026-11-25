import { ApiProperty } from '@nestjs/swagger';

/** Swagger description of the success envelope (`data` is added per endpoint). */
export class ApiResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Request successful' })
  message: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/health' })
  path: string;
}

/** Swagger description of the error envelope. */
export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({ required: false, type: [String], example: ['email must be an email'] })
  errors?: string[];

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/resource' })
  path: string;
}
