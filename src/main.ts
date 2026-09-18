import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { setupApp } from './app.setup.js';
import { swaggerConfiguration } from './config/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  setupApp(app);

  const port = app.get(ConfigService).getOrThrow<number>('app.port');
  swaggerConfiguration(app, port);

  await app.listen(port);
}
await bootstrap();
