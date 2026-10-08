import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Roles } from '../src/modules/auth/decorators/index.js';
import { UserRole } from '../src/modules/users/enums/index.js';
import { authenticate } from './utils/auth.js';

// Rutas que solo existen en este test, para comprobar @Roles de punta a punta
// sin depender de ningún controlador real
@Controller('e2e-roles')
class RolesProbeController {
  @Get('open')
  open() {
    return { ok: true };
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  admin() {
    return { ok: true };
  }

  @Get('staff')
  @Roles(UserRole.ADMIN, UserRole.WAITER)
  staff() {
    return { ok: true };
  }
}

/** Criterios de HU-017: autenticación obligatoria y permisos por rol (RN-099 … RN-102). */
describe('Roles (e2e)', () => {
  let app: INestApplication<App>;
  const sessions: Awaited<ReturnType<typeof authenticate>>[] = [];
  const as = async (role: UserRole) => {
    const session = await authenticate(app, role);
    sessions.push(session);
    return session.http();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RolesProbeController],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
  });

  afterAll(async () => {
    for (const session of sessions) await session.cleanup();
    await app?.close();
  });

  it('sin token, una ruta con @Roles responde 401 (RN-100)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/e2e-roles/admin')
      .expect(401);
  });

  it('una ruta sin @Roles deja pasar a cualquier rol autenticado', async () => {
    for (const role of Object.values(UserRole)) {
      await (await as(role)).get('/api/v1/e2e-roles/open').expect(200);
    }
  });

  it('un rol incluido en @Roles accede (RN-101)', async () => {
    await (await as(UserRole.ADMIN)).get('/api/v1/e2e-roles/admin').expect(200);
    await (
      await as(UserRole.WAITER)
    )
      .get('/api/v1/e2e-roles/staff')
      .expect(200);
  });

  it.each([UserRole.WAITER, UserRole.KITCHEN, UserRole.CUSTOMER])(
    'el rol %s no accede a una ruta solo de ADMIN: 403 con el formato uniforme (RN-102)',
    async (role) => {
      const res = await (
        await as(role)
      )
        .get('/api/v1/e2e-roles/admin')
        .expect(403);

      expect(res.body).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        message: 'No tienes permisos para realizar esta operación',
        path: '/api/v1/e2e-roles/admin',
      });
    },
  );

  it('un rol no incluido recibe 403 aunque otra ruta sí lo admita', async () => {
    await (
      await as(UserRole.CUSTOMER)
    )
      .get('/api/v1/e2e-roles/staff')
      .expect(403);
  });
});
