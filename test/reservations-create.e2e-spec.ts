import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';
import { ReservationStatus } from '../src/modules/reservations/enums/index.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableZone } from '../src/modules/tables/enums/index.js';
import { authenticate } from './utils/auth.js';

/**
 * Criterios de aceptación de HU-007 contra PostgreSQL real.
 * Cubre: creación en PENDING con mesa asignada, mesa más ajustada,
 * solicitudes simultáneas (RN-045), sin disponibilidad, validaciones y token.
 *
 * Aislamiento: mesas propias con capacidad 201 y 202 y fechas de 2099; con
 * guests 201 solo sirven estas mesas, aunque la base tenga otras.
 */
describe('Reservations: registro (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const base = '/api/v1/reservations';

  const baseNumber = 4_000_000 + (Date.now() % 1_000_000);
  let small: Table; // capacidad 201: la más ajustada
  let large: Table; // capacidad 202

  const body = (overrides: Record<string, unknown> = {}) => ({
    customerName: 'Carlos Pérez',
    phone: '3001234567',
    email: 'carlos@example.com',
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

    const tables = dataSource.getRepository(Table);
    large = await tables.save({
      number: baseNumber,
      capacity: 202,
      zone: TableZone.VIP,
    });
    small = await tables.save({
      number: baseNumber + 1,
      capacity: 201,
      zone: TableZone.VIP,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const table of [small, large].filter(Boolean)) {
        await dataSource
          .getRepository(Reservation)
          .delete({ tableId: table.id });
        await dataSource.getRepository(Table).delete({ id: table.id });
      }
    }
    await auth?.cleanup();
    await app?.close();
  });

  describe('POST /reservations', () => {
    it('crea la reserva en PENDING y le asigna la mesa más ajustada (RN-046)', async () => {
      const res = await auth
        .http()
        .post(base)
        .send(body({ date: '2099-06-02' }))
        .expect(201);

      expect(res.body).toMatchObject({
        customerName: 'Carlos Pérez',
        date: '2099-06-02',
        time: '19:00',
        guests: 201,
        status: ReservationStatus.PENDING,
        table: { id: small.id, capacity: 201 },
      });
    });

    it('la reserva queda guardada y se puede consultar', async () => {
      const created = await auth
        .http()
        .post(base)
        .send(body({ date: '2099-06-03' }))
        .expect(201);

      const res = await auth
        .http()
        .get(`${base}/${created.body.id}`)
        .expect(200);
      expect(res.body.table.id).toBe(small.id);
    });

    it('3 solicitudes simultáneas para 2 mesas: dos se crean en mesas distintas y una recibe 409 (RN-044, RN-045)', async () => {
      const responses = await Promise.all(
        [1, 2, 3].map(() => auth.http().post(base).send(body())),
      );

      const created = responses.filter((r) => r.status === 201);
      const rejected = responses.filter((r) => r.status === 409);

      expect(created).toHaveLength(2);
      expect(rejected).toHaveLength(1);
      expect(created.map((r) => r.body.table.id).sort()).toEqual(
        [small.id, large.id].sort(),
      );
      expect(rejected[0].body.rule).toBe('RN-044');
    });

    it('sin mesas con capacidad suficiente responde 409 (RN-044)', async () => {
      const res = await auth
        .http()
        .post(base)
        .send(body({ guests: 9999 }))
        .expect(409);

      expect(res.body.rule).toBe('RN-044');
    });

    it.each([
      ['fecha pasada (RN-042)', { date: '2020-01-01' }],
      ['guests 0 (RN-043)', { guests: 0 }],
      ['email inválido', { email: 'no-es-un-email' }],
      ['hora con formato inválido', { time: '7pm' }],
      ['campo no declarado', { tableId: 'no-permitido' }],
    ])('rechaza %s con 400', async (_case, overrides) => {
      await auth.http().post(base).send(body(overrides)).expect(400);
    });

    it('sin token responde 401', async () => {
      await request(app.getHttpServer()).post(base).send(body()).expect(401);
    });
  });
});
