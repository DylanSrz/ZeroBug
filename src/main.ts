import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { swaggerConfiguration } from './config/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api')

  swaggerConfiguration(app);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
