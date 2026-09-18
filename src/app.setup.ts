import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

export interface AppSetupOptions {
  /** Orígenes permitidos por CORS. ['*'] permite cualquiera (solo desarrollo). */
  corsOrigins: string[];
}

/**
 * Configuración transversal de la aplicación HTTP (RN-010, RN-011, RN-002).
 * Se usa desde main.ts y desde los tests e2e para que ambos apliquen exactamente
 * las mismas reglas: validación global de DTOs, cabeceras de seguridad y CORS.
 */
export function setupApp(
  app: INestApplication,
  options: AppSetupOptions,
): void {
  // Cabeceras de seguridad. La CSP se relaja solo en script/style porque
  // Swagger UI (/api/docs) usa scripts y estilos inline.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  const allowAny = options.corsOrigins.includes('*');
  app.enableCors({
    origin: allowAny ? true : options.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: !allowAny,
  });

  // Todo body/query/param pasa por class-validator antes de llegar al controlador.
  //  - whitelist: elimina propiedades no declaradas en el DTO
  //  - forbidNonWhitelisted: ...y además responde 400 si llegan
  //  - transform: convierte el payload en instancia del DTO (y aplica @Type())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
