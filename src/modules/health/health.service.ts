import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG_KEY, AppConfig } from '../../config/app.config';
import { ServiceStatus } from './constants/health.constants';
import { HealthStatus } from './interfaces/health.interface';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly configService: ConfigService,
  ) {}

  /** Returns the service status, or throws 503 when a dependency is down. */
  async getHealth(): Promise<HealthStatus> {
    const databaseUp = await this.healthRepository.isDatabaseReachable();
    if (!databaseUp) {
      throw new ServiceUnavailableException('Database is unreachable');
    }

    const { env } = this.configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

    return {
      status: ServiceStatus.Ok,
      environment: env,
      uptimeSeconds: Math.floor(process.uptime()),
      checks: { database: ServiceStatus.Up },
    };
  }
}
