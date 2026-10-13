import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Like } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { UserStatus } from '../src/modules/users/enums/index.js';

/**
 * Criterios de aceptación de HU-014 (registro) y HU-015 (login y JWT) contra PostgreSQL real.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const http = () => request(app.getHttpServer());
  const runId = Date.now();
  // Todos los correos de esta ejecución comparten prefijo para borrarlos al final
  const email = (suffix: string) => `e2e-auth-${runId}-${suffix}@example.com`;

  const body = (overrides: Record<string, unknown> = {}) => ({
    firstName: 'Carlos',
    lastName: 'Pérez',
    email: email('ok'),
    phone: '+57 300 123 4567',
    password: 'Password123',
    passwordConfirmation: 'Password123',
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(User)
        .delete({ email: Like(`e2e-auth-${runId}-%`) });
    }
    await app?.close();
  });

  describe('POST /auth/register', () => {
    const url = '/api/v1/auth/register';

    it('registra un cliente ACTIVE con rol CUSTOMER y responde sin contraseña (RN-086, RN-087)', async () => {
      const res = await http().post(url).send(body()).expect(201);

      expect(res.body).toMatchObject({
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: email('ok'),
        phone: '+57 300 123 4567',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('passwordConfirmation');
    });

    it('guarda la cuenta en PostgreSQL con la contraseña cifrada (RN-085)', async () => {
      const stored = await dataSource
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: email('ok') })
        .getOneOrFail();

      expect(stored.passwordHash).not.toContain('Password123');
      expect(stored.passwordHash.startsWith('scrypt$')).toBe(true);
    });

    it('rechaza un correo ya registrado, aunque cambien las mayúsculas → 409 RN-082', async () => {
      const res = await http()
        .post(url)
        .send(body({ email: email('ok').toUpperCase() }))
        .expect(409);

      expect(res.body.rule).toBe('RN-082');
    });

    it('rechaza contraseñas que no coinciden → 400 (RN-084)', async () => {
      await http()
        .post(url)
        .send(
          body({ email: email('mismatch'), passwordConfirmation: 'Otra1234' }),
        )
        .expect(400);
    });

    it.each([
      ['corta', 'Pas1'],
      ['sin números', 'Passwordsolo'],
    ])('rechaza una contraseña %s → 400 (RN-083)', async (_caso, password) => {
      await http()
        .post(url)
        .send(
          body({
            email: email('weak'),
            password,
            passwordConfirmation: password,
          }),
        )
        .expect(400);
    });

    it('no permite elegir el rol desde el body → 400', async () => {
      await http()
        .post(url)
        .send(body({ email: email('admin'), role: 'ADMIN' }))
        .expect(400);
    });

    it.each(['firstName', 'lastName', 'email', 'phone', 'password'])(
      'exige %s → 400',
      async (field) => {
        const payload = body({ email: email(`sin-${field}`) });
        delete (payload as Record<string, unknown>)[field];
        await http().post(url).send(payload).expect(400);
      },
    );
  });

  describe('POST /auth/login', () => {
    const url = '/api/v1/auth/login';
    const loginEmail = email('login');

    beforeAll(async () => {
      await http()
        .post('/api/v1/auth/register')
        .send(body({ email: loginEmail }))
        .expect(201);
    });

    it('devuelve un JWT y los datos del usuario, sin contraseña (RN-088, RN-093)', async () => {
      const res = await http()
        .post(url)
        .send({ email: loginEmail, password: 'Password123' })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: loginEmail,
        role: 'CUSTOMER',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password|scrypt\$/i);
    });

    it('el token lleva sub, email y rol, y expira (RN-092)', async () => {
      const res = await http()
        .post(url)
        .send({ email: loginEmail, password: 'Password123' })
        .expect(200);

      const payload = app.get(JwtService).decode(res.body.accessToken);
      expect(payload).toMatchObject({
        sub: res.body.user.id,
        email: loginEmail,
        role: 'CUSTOMER',
      });
      expect(payload.exp - payload.iat).toBe(3600);
    });

    it('acepta el email con otras mayúsculas', async () => {
      await http()
        .post(url)
        .send({ email: loginEmail.toUpperCase(), password: 'Password123' })
        .expect(200);
    });

    it('rechaza con el mismo mensaje un email inexistente y una contraseña incorrecta (RN-091)', async () => {
      const unknownEmail = await http()
        .post(url)
        .send({ email: email('no-existe'), password: 'Password123' })
        .expect(401);
      const wrongPassword = await http()
        .post(url)
        .send({ email: loginEmail, password: 'Equivocada1' })
        .expect(401);

      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('rechaza una cuenta INACTIVE con el mismo mensaje genérico (RN-090, RN-091)', async () => {
      const inactiveEmail = email('inactiva');
      await http()
        .post('/api/v1/auth/register')
        .send(body({ email: inactiveEmail }))
        .expect(201);
      await dataSource
        .getRepository(User)
        .update({ email: inactiveEmail }, { status: UserStatus.INACTIVE });

      const res = await http()
        .post(url)
        .send({ email: inactiveEmail, password: 'Password123' })
        .expect(401);
      const wrongPassword = await http()
        .post(url)
        .send({ email: loginEmail, password: 'Equivocada1' })
        .expect(401);

      expect(res.body.message).toBe(wrongPassword.body.message);
    });

    it.each([
      ['sin email', { password: 'Password123' }],
      ['sin contraseña', { email: 'a@example.com' }],
      ['con email inválido', { email: 'no-es-email', password: 'x' }],
    ])('responde 400 %s', async (_caso, payload) => {
      await http().post(url).send(payload).expect(400);
    });
  });

  describe('JWT en endpoints protegidos (RN-094)', () => {
    const protectedUrl = '/api/v1/tables';
    const bearer = (token: string) => `Bearer ${token}`;
    let validToken: string;
    let userId: string;

    beforeAll(async () => {
      const loginEmail = email('guard');
      await http()
        .post('/api/v1/auth/register')
        .send(body({ email: loginEmail }))
        .expect(201);
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: loginEmail, password: 'Password123' })
        .expect(200);
      validToken = res.body.accessToken;
      userId = res.body.user.id;
    });

    it('sin token → 401', async () => {
      await http().get(protectedUrl).expect(401);
    });

    it('token inválido → 401', async () => {
      await http()
        .get(protectedUrl)
        .set('Authorization', bearer('no.es.un-token'))
        .expect(401);
    });

    it('token con firma de otro secreto → 401', async () => {
      const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync(
        {
          sub: userId,
          email: 'a@example.com',
          role: 'ADMIN',
        },
      );
      await http()
        .get(protectedUrl)
        .set('Authorization', bearer(forged))
        .expect(401);
    });

    it('token expirado → 401', async () => {
      const expired = await app
        .get(JwtService)
        .signAsync(
          { sub: userId, email: 'a@example.com', role: 'CUSTOMER' },
          { expiresIn: -10 },
        );
      await http()
        .get(protectedUrl)
        .set('Authorization', bearer(expired))
        .expect(401);
    });

    it('token válido → pasa el guard (200)', async () => {
      await http()
        .get(protectedUrl)
        .set('Authorization', bearer(validToken))
        .expect(200);
    });

    it('el mismo mensaje para cualquier fallo de token', async () => {
      const missing = await http().get(protectedUrl).expect(401);
      const invalid = await http()
        .get(protectedUrl)
        .set('Authorization', bearer('basura'))
        .expect(401);
      expect(missing.body.message).toBe(invalid.body.message);
    });

    it('un token válido deja de servir si la cuenta se desactiva', async () => {
      await dataSource
        .getRepository(User)
        .update({ id: userId }, { status: UserStatus.INACTIVE });

      await http()
        .get(protectedUrl)
        .set('Authorization', bearer(validToken))
        .expect(401);
    });

    it.each(['/api/v1/health', '/api/v1/menu', '/api/v1/auth/login'])(
      '%s es público: no exige token',
      async (url) => {
        const res = await http().get(url);
        expect(res.status).not.toBe(401);
      },
    );
  });
});
