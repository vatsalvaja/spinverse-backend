import { ApiProperty } from '@nestjs/swagger';
import { ServiceStatus } from '../constants/health.constants';

class HealthChecksDto {
  @ApiProperty({ enum: [ServiceStatus.Up], example: ServiceStatus.Up })
  database: ServiceStatus.Up;
}

export class HealthResponseDto {
  @ApiProperty({ enum: [ServiceStatus.Ok], example: ServiceStatus.Ok })
  status: ServiceStatus.Ok;

  @ApiProperty({ example: 'development' })
  environment: string;

  @ApiProperty({ description: 'Seconds since the process started', example: 123 })
  uptimeSeconds: number;

  @ApiProperty({ type: HealthChecksDto })
  checks: HealthChecksDto;
}
