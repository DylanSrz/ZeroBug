import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { swaggerConfiguration } from './config/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api')

  const port = app.get(ConfigService).getOrThrow<number>('app.port');
  swaggerConfiguration(app, port);

  await app.listen(port);
}
await bootstrap();
