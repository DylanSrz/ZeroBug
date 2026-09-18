import { INestApplication, VersioningType } from '@nestjs/common';

interface AppSetupOptions {
  corsOrigins?: string[];
}

export function setupApp(
  app: INestApplication,
  options: AppSetupOptions = {},
): void {
  app.setGlobalPrefix('/api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  if (options.corsOrigins) {
    app.enableCors({ origin: options.corsOrigins });
  }
}
