import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { APP_CONFIG_KEY, AppConfig } from './config/app.config';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG_KEY);

  app.setGlobalPrefix(config.apiPrefix);
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();
  setupSwagger(app, config);

  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(`API running on http://localhost:${config.port}/${config.apiPrefix}`);
  if (config.swagger.enabled) {
    logger.log(`Swagger docs on http://localhost:${config.port}/${config.swagger.path}`);
  }
}

void bootstrap();
