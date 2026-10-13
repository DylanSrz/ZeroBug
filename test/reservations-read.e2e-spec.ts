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

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-008 contra PostgreSQL real.
 * Cubre: listar (incluidas canceladas), filtros, paginación, obtener por id
 * con su mesa, inexistente -> 404, id que no es UUID -> 400, sin token -> 401.
 */
describe('Reservations: consulta (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const http = () => auth.http();
  const base = '/api/v1/reservations';

  // Mesa propia de esta corrida: filtrando por su id, los tests solo ven las
  // reservas que crean ellos, aunque la base tenga otras.
  let table: Table;
  let pending: Reservation;
  let cancelled: Reservation;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    auth = await authenticate(app);
    dataSource = app.get(DataSource);

    table = await dataSource.getRepository(Table).save({
      // integer de PostgreSQL: base única por corrida y dentro del rango
      number: 2_000_000 + (Date.now() % 1_000_000),
      capacity: 4,
      zone: TableZone.TERRACE,
    });

    const reservations = dataSource.getRepository(Reservation);
    pending = await reservations.save({
      customerName: 'E2E Consulta',
      phone: '3001234567',
      email: 'e2e-consulta@example.com',
      date: '2099-01-10',
      time: '19:00',
      guests: 2,
      status: ReservationStatus.PENDING,
      tableId: table.id,
    });
    cancelled = await reservations.save({
      customerName: 'E2E Consulta',
      phone: '3001234567',
      email: 'e2e-consulta@example.com',
      date: '2099-01-11',
      time: '20:00',
      guests: 2,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      tableId: table.id,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && table) {
      await dataSource.getRepository(Reservation).delete({ tableId: table.id });
      await dataSource.getRepository(Table).delete({ id: table.id });
    }
    await auth?.cleanup();
    await app?.close();
  });

  describe('GET /reservations', () => {
    it('sin token responde 401', async () => {
      await request(app.getHttpServer()).get(base).expect(401);
    });

    it('lista por fecha y hora, incluidas las canceladas (RN-051)', async () => {
      const res = await http()
        .get(base)
        .query({ tableId: table.id })
        .expect(200);

      expect(res.body.map((r: Reservation) => r.id)).toEqual([
        pending.id,
        cancelled.id,
      ]);
      expect(res.body[1].status).toBe(ReservationStatus.CANCELLED);
    });

    it('filtra por estado', async () => {
      const res = await http()
        .get(base)
        .query({ tableId: table.id, status: ReservationStatus.CANCELLED })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(cancelled.id);
    });

    it('filtra por fecha', async () => {
      const res = await http()
        .get(base)
        .query({ tableId: table.id, date: '2099-01-10' })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(pending.id);
    });

    it('pagina con page y limit', async () => {
      const res = await http()
        .get(base)
        .query({ tableId: table.id, page: 2, limit: 1 })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(cancelled.id);
    });

    it('rechaza filtros inválidos con 400', async () => {
      await http().get(base).query({ page: 0 }).expect(400);
      await http().get(base).query({ status: 'BORRADA' }).expect(400);
    });
  });

  describe('GET /reservations/:id', () => {
    it('devuelve la reserva con su estado y su mesa (RN-049, RN-050)', async () => {
      const res = await http().get(`${base}/${pending.id}`).expect(200);

      expect(res.body).toMatchObject({
        id: pending.id,
        status: ReservationStatus.PENDING,
        date: '2099-01-10',
        time: '19:00',
        table: {
          id: table.id,
          number: table.number,
          zone: TableZone.TERRACE,
          capacity: 4,
        },
      });
    });

    it('inexistente responde 404 (RN-048)', async () => {
      await http().get(`${base}/${UNKNOWN_ID}`).expect(404);
    });

    it('un id que no es UUID responde 400', async () => {
      await http().get(`${base}/abc`).expect(400);
    });

    it('sin token responde 401', async () => {
      await request(app.getHttpServer())
        .get(`${base}/${pending.id}`)
        .expect(401);
    });
  });
});
