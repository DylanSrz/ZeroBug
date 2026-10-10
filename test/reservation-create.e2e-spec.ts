import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';
import { ReservationStatus } from '../src/modules/reservations/enums/index.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableZone } from '../src/modules/tables/enums/index.js';
import { authenticate } from './utils/auth.js';

//Criterios de aceptación de HU-007 contra PostgreSQL real.
//Cubre: crear con mesa asignada, concurrencia por la última mesa (RN-045),
//datos inválidos -> 400 y sin token -> 401.

describe('Reservations: creación (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const http = () => auth.http();
  const base = '/api/v1/reservations';

  // Dos mesas propias con capacidad 201 y 202: pidiendo guests: 201 solo ellas
  // pueden servir, así los datos de otros tests no interfieren.
  let tableSmall: Table;
  let tableLarge: Table;

  const payload = (overrides: Record<string, unknown> = {}) => ({
    customerName: 'E2E Reserva',
    phone: '3001234567',
    email: 'e2e-reserva@example.com',
    date: '2099-06-01',
    time: '19:00',
    guests: 201,
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    auth = await authenticate(app);
    dataSource = app.get(DataSource);

    // number único por corrida y dentro del rango del integer de PostgreSQL
    const number = 3_000_000 + (Date.now() % 1_000_000);
    const tables = dataSource.getRepository(Table);
    tableSmall = await tables.save({
      number,
      capacity: 201,
      zone: TableZone.INTERIOR,
    });
    tableLarge = await tables.save({
      number: number + 1,
      capacity: 202,
      zone: TableZone.INTERIOR,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && tableSmall && tableLarge) {
      const ids = [tableSmall.id, tableLarge.id];
      await dataSource.getRepository(Reservation).delete({ tableId: In(ids) });
      await dataSource.getRepository(Table).delete({ id: In(ids) });
    }
    await auth?.cleanup();
    await app?.close();
  });

  it('crea la reserva PENDING y le asigna la mesa más ajustada', async () => {
    const res = await http().post(base).send(payload()).expect(201);

    expect(res.body).toMatchObject({
      status: ReservationStatus.PENDING,
      guests: 201,
      date: '2099-06-01',
      time: '19:00',
      table: { id: tableSmall.id, capacity: 201 },
    });
  });

  it('con 3 peticiones a la vez por 2 mesas libres: dos 201 en mesas distintas y un 409 (RN-045)', async () => {
    const body = payload({ date: '2099-06-02' });

    const responses = await Promise.all([
      http().post(base).send(body),
      http().post(base).send(body),
      http().post(base).send(body),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 201, 409]);

    const created = responses.filter((r) => r.status === 201);
    expect(new Set(created.map((r) => r.body.table.id)).size).toBe(2);

    const rejected = responses.find((r) => r.status === 409);
    expect(rejected?.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      rule: 'RN-044',
      path: base,
    });
  });

  it('rechaza una fecha pasada con 400', async () => {
    await http()
      .post(base)
      .send(payload({ date: '2020-01-01' }))
      .expect(400);
  });

  it('rechaza un email inválido con 400', async () => {
    await http()
      .post(base)
      .send(payload({ email: 'no-es-un-email' }))
      .expect(400);
  });

  it('rechaza guests: 0 con 400', async () => {
    await http()
      .post(base)
      .send(payload({ guests: 0 }))
      .expect(400);
  });

  it('responde 401 sin token', async () => {
    await request(app.getHttpServer()).post(base).send(payload()).expect(401);
  });
});
