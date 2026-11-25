import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from './app.config';

/** Mounts Swagger UI at `/<SWAGGER_PATH>` when `SWAGGER_ENABLED=true`. */
export function setupSwagger(app: INestApplication, { swagger }: AppConfig): void {
  if (!swagger.enabled) return;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SPINVERSE API')
      .setDescription('SPINVERSE backend REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(swagger.path, app, document);
}
