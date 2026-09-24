// Carga reflect-metadata al iniciar la aplicación para que NestJS pueda
// leer en tiempo de ejecución la información de tipos y decoradores,
// necesaria para que ValidationPipe identifique correctamente los DTOs
// como CreateTableDto y aplique sus validaciones.

import 'reflect-metadata';

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

  await app.listen(port);
}
await bootstrap();
