import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto';
import { HEALTH_API_TAG, HEALTH_ROUTE } from './constants/health.constants';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';
import { HealthStatus } from './interfaces/health.interface';

@ApiTags(HEALTH_API_TAG)
@Controller(HEALTH_ROUTE)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ResponseMessage('Service is healthy')
  @ApiOperation({ summary: 'Check API and database health' })
  @ApiSuccessResponse(HealthResponseDto, 'Service and database are healthy')
  @ApiServiceUnavailableResponse({
    description: 'Database is unreachable',
    type: ApiErrorResponseDto,
  })
  getHealth(): Promise<HealthStatus> {
    return this.healthService.getHealth();
  }
}
