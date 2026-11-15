import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { createAppValidationPipe } from './common/validation/app-validation.pipe';

async function bootstrap(): Promise<void> {
  const logger = new JsonLoggerService('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger,
  });

  app.enableShutdownHooks();
  app.useGlobalPipes(createAppValidationPipe());

  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('corsOrigins', [
    'http://localhost:3000',
  ]);
  const port = configService.get<number>('port', 4000);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription(
      'REST API đặt đồ uống BrewLite (Customer order + Mock payment + Staff fulfillment)',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');
  logger.log({ event: 'server_started', host: '0.0.0.0', port }, 'Bootstrap');
}

void bootstrap();
