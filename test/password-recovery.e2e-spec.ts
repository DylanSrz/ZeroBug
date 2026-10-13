import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Like } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PasswordResetToken } from '../src/modules/auth/entities/password-reset-token.entity.js';
import { MailService } from '../src/modules/auth/mail/index.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { UserStatus } from '../src/modules/users/enums/index.js';

/**
 * Criterios de aceptación de HU-018 (recuperación de contraseña) contra PostgreSQL real.
 */
describe('Password recovery (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Correo falso: guarda cada enlace enviado, en vez de escribirlo en el log
  const sent: { to: string; link: string }[] = [];
  const fakeMail = {
    sendPasswordReset: (to: string, link: string) => {
      sent.push({ to, link });
      return Promise.resolve();
    },
  };

  const http = () => request(app.getHttpServer());
  const runId = Date.now();
  const email = (suffix: string) => `e2e-rec-${runId}-${suffix}@example.com`;
  const OLD_PASSWORD = 'Password123';
  const NEW_PASSWORD = 'NuevaClave456';

  const forgot = (to: string) =>
    http().post('/api/v1/auth/forgot-password').send({ email: to });
  const reset = (
    token: string,
    password = NEW_PASSWORD,
    confirmation = password,
  ) =>
    http().post('/api/v1/auth/reset-password').send({
      token,
      password,
      passwordConfirmation: confirmation,
    });
  const login = (to: string, password: string) =>
    http().post('/api/v1/auth/login').send({ email: to, password });

  // Registra una cuenta, pide la recuperación y devuelve el token del "correo"
  async function accountWithToken(suffix: string) {
    const to = email(suffix);
    await http()
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: to,
        phone: '+57 300 123 4567',
        password: OLD_PASSWORD,
        passwordConfirmation: OLD_PASSWORD,
      })
      .expect(201);
    await forgot(to).expect(200);
    const token = tokenSentTo(to);
    return { to, token };
  }
  const tokenSentTo = (to: string) => {
    const last = [...sent].reverse().find((mail) => mail.to === to);
    return new URL(last!.link).searchParams.get('token')!;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    // Los tokens se borran solos con el usuario (ON DELETE CASCADE)
    await dataSource
      ?.getRepository(User)
      .delete({ email: Like(`e2e-rec-${runId}-%`) });
    await app?.close();
  });

  it('flujo completo: solicitar → restablecer → entrar con la nueva contraseña', async () => {
    const { to, token } = await accountWithToken('flujo');

    await reset(token).expect(200);

    await login(to, NEW_PASSWORD).expect(200);
    await login(to, OLD_PASSWORD).expect(401);
  });

  describe('POST /auth/forgot-password', () => {
    it('responde 200 con el mismo mensaje exista o no el correo, y no envía nada si no existe', async () => {
      const { to } = await accountWithToken('existe');
      const sentBefore = sent.length;

      const known = await forgot(to).expect(200);
      const unknown = await forgot(email('no-existe')).expect(200);

      expect(known.body).toEqual(unknown.body);
      expect(sent.length).toBe(sentBefore + 1);
    });

    it('guarda solo el hash del token, con vencimiento a los 30 minutos (RN-103)', async () => {
      const { to, token } = await accountWithToken('hash');

      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email: to });
      const saved = await dataSource
        .getRepository(PasswordResetToken)
        .findOneByOrFail({ userId: user.id });

      expect(saved.tokenHash).toHaveLength(64);
      expect(saved.tokenHash).not.toBe(token);
      expect(saved.usedAt).toBeNull();
      const minutes = (saved.expiresAt.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(29);
      expect(minutes).toBeLessThanOrEqual(30);
    });

    it('un token nuevo anula el anterior', async () => {
      const { to, token: first } = await accountWithToken('doble');
      await forgot(to).expect(200);
      const second = tokenSentTo(to);

      expect(second).not.toBe(first);
      await reset(first).expect(400);
      await reset(second).expect(200);
    });

    it('no envía nada a una cuenta INACTIVE', async () => {
      const { to } = await accountWithToken('inactiva');
      await dataSource
        .getRepository(User)
        .update({ email: to }, { status: UserStatus.INACTIVE });
      const sentBefore = sent.length;

      await forgot(to).expect(200);

      expect(sent.length).toBe(sentBefore);
    });

    it('rechaza un correo con formato inválido → 400', async () => {
      await forgot('no-es-un-correo').expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('el token no puede reutilizarse (RN-104)', async () => {
      const { token } = await accountWithToken('reuso');

      await reset(token).expect(200);
      const second = await reset(token, 'OtraClave789').expect(400);

      expect(second.body.message).toBe(
        'El enlace de recuperación es inválido o ha expirado',
      );
    });

    it('un token expirado se rechaza con el mismo mensaje (RN-103)', async () => {
      const { to, token } = await accountWithToken('expirado');
      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email: to });
      await dataSource
        .getRepository(PasswordResetToken)
        .update(
          { userId: user.id },
          { expiresAt: new Date(Date.now() - 1000) },
        );

      const res = await reset(token).expect(400);

      expect(res.body.message).toBe(
        'El enlace de recuperación es inválido o ha expirado',
      );
      await login(to, OLD_PASSWORD).expect(200);
    });

    it('un token inventado se rechaza con el mismo mensaje', async () => {
      const res = await reset('x'.repeat(43)).expect(400);

      expect(res.body.message).toBe(
        'El enlace de recuperación es inválido o ha expirado',
      );
    });

    it('rechaza una contraseña débil y NO gasta el token (RN-105)', async () => {
      const { to, token } = await accountWithToken('debil');

      await reset(token, 'corta1').expect(400);
      await reset(token, 'sinnumeros').expect(400);
      await reset(token, NEW_PASSWORD, 'OtraDistinta1').expect(400);

      // El token sigue sirviendo: la validación falló antes de consumirlo
      await reset(token).expect(200);
      await login(to, NEW_PASSWORD).expect(200);
    });

    it('la nueva contraseña se guarda cifrada (RN-106)', async () => {
      const { to, token } = await accountWithToken('cifrada');
      await reset(token).expect(200);

      const stored = await dataSource
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :to', { to })
        .getOneOrFail();

      expect(stored.passwordHash.startsWith('scrypt$')).toBe(true);
      expect(stored.passwordHash).not.toContain(NEW_PASSWORD);
    });

    it('una cuenta desactivada después de pedir el token no puede restablecer', async () => {
      const { to, token } = await accountWithToken('desactivada');
      await dataSource
        .getRepository(User)
        .update({ email: to }, { status: UserStatus.INACTIVE });

      await reset(token).expect(400);
    });

    it('dos peticiones simultáneas con el mismo token: solo una lo consigue', async () => {
      const { token } = await accountWithToken('carrera');

      const results = await Promise.all([reset(token), reset(token)]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    });
  });
});
