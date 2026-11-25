import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthRepository {
  private readonly logger = new Logger(HealthRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs a trivial query to confirm PostgreSQL is reachable. */
  async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }
}
