import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { setupApp } from './app.setup.js';
import { swaggerConfiguration } from './config/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = app.get(ConfigService);

  setupApp(app, {
    corsOrigins: config.getOrThrow<string[]>('app.corsOrigins'),
  });

  const port = config.getOrThrow<number>('app.port');
  swaggerConfiguration(app, port);

  await app.listen(400);
}
await bootstrap();
