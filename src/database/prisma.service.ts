import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client. The connection string comes from `DATABASE_URL`
 * (see `.env`). The app fails fast at startup if the database is unreachable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL');
    } catch (error) {
      this.logger.error(
        'Could not connect to PostgreSQL. Check DATABASE_URL in your .env file and make sure the database server is running.',
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
