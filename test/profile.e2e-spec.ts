import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { UserRole } from '../src/modules/users/enums/index.js';
import { authenticate } from './utils/auth.js';

/**
 * Criterios de aceptación de HU-019 contra PostgreSQL real: consultar y
 * actualizar el propio perfil, sin contraseña en las respuestas y sin poder
 * cambiar campos administrativos (RN-107 … RN-110).
 */
describe('Profile (e2e)', () => {
  let app: INestApplication<App>;
  let userA: Awaited<ReturnType<typeof authenticate>>;
  let userB: Awaited<ReturnType<typeof authenticate>>;
  const base = '/api/v1/profile';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    userA = await authenticate(app, UserRole.CUSTOMER);
    userB = await authenticate(app, UserRole.WAITER);
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
    await app?.close();
  });

  it('sin token responde 401 (RN-109)', async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer())
      .patch(base)
      .send({ firstName: 'X' })
      .expect(401);
  });

  it('devuelve el perfil propio sin la contraseña (RN-108)', async () => {
    const res = await userA.http().get(base).expect(200);

    expect(res.body).toMatchObject({
      id: userA.user.id,
      email: userA.user.email,
      firstName: 'E2E',
      role: UserRole.CUSTOMER,
      status: 'ACTIVE',
    });
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('cada usuario ve solo su propia información (RN-107)', async () => {
    const res = await userB.http().get(base).expect(200);

    expect(res.body.id).toBe(userB.user.id);
    expect(res.body.email).not.toBe(userA.user.email);
  });

  it('actualiza nombre, apellido y teléfono y quedan guardados', async () => {
    const res = await userA
      .http()
      .patch(base)
      .send({
        firstName: 'Carlos',
        lastName: 'Pérez',
        phone: '+57 311 000 0000',
      })
      .expect(200);

    expect(res.body).toMatchObject({
      firstName: 'Carlos',
      lastName: 'Pérez',
      phone: '+57 311 000 0000',
    });
    expect(res.body).not.toHaveProperty('passwordHash');

    const stored = await userA.http().get(base).expect(200);
    expect(stored.body).toMatchObject({
      firstName: 'Carlos',
      phone: '+57 311 000 0000',
    });

    // El otro usuario no cambió
    const other = await userB.http().get(base).expect(200);
    expect(other.body.firstName).toBe('E2E');
  });

  it.each([
    { email: 'otro@example.com' },
    { role: UserRole.ADMIN },
    { status: 'INACTIVE' },
    { password: 'Password999' },
  ])(
    'no permite cambiar campos administrativos: %o responde 400 (RN-110)',
    async (body) => {
      await userA.http().patch(base).send(body).expect(400);
    },
  );

  it('rechaza datos inválidos con 400', async () => {
    await userA.http().patch(base).send({ firstName: '' }).expect(400);
    await userA.http().patch(base).send({ phone: 'abc' }).expect(400);
  });

  it('el rol sigue siendo el mismo después de intentar cambiarlo', async () => {
    const res = await userA.http().get(base).expect(200);
    expect(res.body.role).toBe(UserRole.CUSTOMER);
  });
});
