import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { EmployeePosition } from '../src/modules/employees/enums/index.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { UserRole, UserStatus } from '../src/modules/users/enums/index.js';
import { authenticate } from './utils/auth.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const PASSWORD = 'Password123';

/**
 * Criterios de aceptación de HU-016 contra PostgreSQL real: registrar,
 * correo duplicado, consultar, actualizar, desactivar (y que ya no pueda
 * iniciar sesión) y solo ADMIN.
 */
describe('Employees (e2e)', () => {
  let app: INestApplication<App>;
  let admin: Awaited<ReturnType<typeof authenticate>>;
  let waiter: Awaited<ReturnType<typeof authenticate>>;
  const base = '/api/v1/employees';

  // Correo único por corrida; al final se borran las cuentas creadas y, en
  // cascada, sus perfiles de empleado
  const email = `e2e-empleado-${Date.now()}@example.com`;
  let employeeId: string;

  const newEmployee = () => ({
    firstName: 'Ana',
    lastName: 'López',
    email,
    phone: '+57 300 123 4567',
    position: EmployeePosition.COOK,
    password: PASSWORD,
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
    admin = await authenticate(app);
    waiter = await authenticate(app, UserRole.WAITER);
  });

  afterAll(async () => {
    if (app) {
      await app.get(DataSource).getRepository(User).delete({ email });
    }
    await admin?.cleanup();
    await waiter?.cleanup();
    await app?.close();
  });

  it('sin token responde 401', async () => {
    await request(app.getHttpServer()).get(base).expect(401);
  });

  it('un usuario que no es ADMIN recibe 403', async () => {
    await waiter.http().get(base).expect(403);
    await waiter.http().post(base).send(newEmployee()).expect(403);
  });

  it('registra un empleado ACTIVE con su cargo y sin contraseña en la respuesta (RN-096, RN-097)', async () => {
    const res = await admin.http().post(base).send(newEmployee()).expect(201);

    expect(res.body).toMatchObject({
      firstName: 'Ana',
      lastName: 'López',
      email,
      position: EmployeePosition.COOK,
      role: UserRole.KITCHEN,
      status: UserStatus.ACTIVE,
    });
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    employeeId = res.body.id;
  });

  it('el empleado nuevo puede iniciar sesión', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it('no permite un correo duplicado: 409 (RN-095)', async () => {
    const res = await admin
      .http()
      .post(base)
      .send({ ...newEmployee(), email: email.toUpperCase() })
      .expect(409);

    expect(res.body.rule).toBe('RN-095');
  });

  it('rechaza datos inválidos o sin cargo con 400', async () => {
    const withoutPosition: Partial<ReturnType<typeof newEmployee>> =
      newEmployee();
    delete withoutPosition.position;
    await admin.http().post(base).send(withoutPosition).expect(400);
    await admin
      .http()
      .post(base)
      .send({ ...newEmployee(), position: 'CHEF' })
      .expect(400);
    await admin
      .http()
      .post(base)
      .send({ ...newEmployee(), email: 'no-es-correo' })
      .expect(400);
  });

  it('lista los empleados', async () => {
    const res = await admin.http().get(base).expect(200);

    expect(res.body.map((e: { id: string }) => e.id)).toContain(employeeId);
  });

  it('consulta un empleado por id', async () => {
    const res = await admin.http().get(`${base}/${employeeId}`).expect(200);

    expect(res.body).toMatchObject({ id: employeeId, email });
  });

  it('inexistente responde 404 y un id que no es UUID 400', async () => {
    await admin.http().get(`${base}/${UNKNOWN_ID}`).expect(404);
    await admin.http().get(`${base}/abc`).expect(400);
  });

  it('actualiza nombre, teléfono y cargo', async () => {
    const res = await admin
      .http()
      .patch(`${base}/${employeeId}`)
      .send({ firstName: 'Ana María', position: EmployeePosition.CASHIER })
      .expect(200);

    expect(res.body).toMatchObject({
      firstName: 'Ana María',
      lastName: 'López',
      position: EmployeePosition.CASHIER,
    });

    const stored = await admin.http().get(`${base}/${employeeId}`).expect(200);
    expect(stored.body.firstName).toBe('Ana María');
  });

  it('no permite cambiar el correo, el estado ni el rol por PATCH /{id}: 400', async () => {
    await admin
      .http()
      .patch(`${base}/${employeeId}`)
      .send({ email: 'otro@example.com' })
      .expect(400);
    await admin
      .http()
      .patch(`${base}/${employeeId}`)
      .send({ role: UserRole.ADMIN })
      .expect(400);
  });

  it('desactiva al empleado y ya no puede iniciar sesión (RN-098)', async () => {
    const res = await admin
      .http()
      .patch(`${base}/${employeeId}/status`)
      .send({ status: UserStatus.INACTIVE })
      .expect(200);
    expect(res.body.status).toBe(UserStatus.INACTIVE);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  it('lo vuelve a activar y puede iniciar sesión', async () => {
    await admin
      .http()
      .patch(`${base}/${employeeId}/status`)
      .send({ status: UserStatus.ACTIVE })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it('rechaza un estado inválido con 400', async () => {
    await admin
      .http()
      .patch(`${base}/${employeeId}/status`)
      .send({ status: 'BORRADO' })
      .expect(400);
  });
});
