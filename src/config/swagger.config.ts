import { createRequire } from 'node:module';
import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const logger = new Logger('Swagger');

// Versión y nombre desde package.json (funciona en src/ y en dist/, ambos a dos niveles de la raíz).
const pkg = createRequire(import.meta.url)('../../package.json') as {
  name: string;
  version: string;
  description: string;
};

/** Ruta relativa al prefijo global. Swagger queda fuera del versionado /api/v1. */
export const SWAGGER_PATH = 'api/docs';

/**
 * Documentación OpenAPI (RN-012). Cada módulo se agrupa con `@ApiTags('Nombre')`
 * en su controlador; aquí solo se declaran los tags con su descripción.
 */
export const swaggerConfiguration = (
  app: INestApplication,
  port: number,
): void => {
  const config = new DocumentBuilder()
    .setTitle('ZeroBug — Restaurant API')
    .setDescription(
      [
        pkg.description,
        '',
        'Todos los recursos viven bajo `/api/v1`. Los errores siguen un formato uniforme:',
        '`{ statusCode, error, message, path, timestamp, rule? }`.',
        '',
        'Historias de usuario y reglas de negocio (RN-xxx): carpeta `docs/` del repositorio.',
      ].join('\n'),
    )
    .setVersion(pkg.version)
    .setContact('Equipo ZeroBug', 'https://github.com/DylanSrz/ZeroBug', '')
    .addTag('Health', 'Estado del servicio')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token (Sprint 3, HU-015)',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'ZeroBug API — Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  logger.log(`Docs disponibles en http://localhost:${port}/${SWAGGER_PATH}`);
};
