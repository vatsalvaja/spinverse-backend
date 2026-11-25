import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DemoWalletModule } from './modules/demo-wallet/demo-wallet.module';
import { GameCategoriesModule } from './modules/game-categories/game-categories.module';
import { GameEngineModule } from './modules/game-engine/game-engine.module';
import { GameHistoryModule } from './modules/game-history/game-history.module';
import { GamePackagesModule } from './modules/game-packages/game-packages.module';
import { GamesModule } from './modules/games/games.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    GameCategoriesModule,
    GamesModule,
    GamePackagesModule,
    DemoWalletModule,
    GameEngineModule,
    GameHistoryModule,
    AdminDashboardModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
