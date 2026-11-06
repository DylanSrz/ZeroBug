import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';
import { ReservationStatus } from '../src/modules/reservations/enums/index.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableStatus, TableZone } from '../src/modules/tables/enums/index.js';
import { authenticate } from './utils/auth.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-012 contra PostgreSQL real.
 * Cubre: check-in de una CONFIRMED (la mesa pasa a OCCUPIED), PENDING -> 409,
 * check-in repetido -> 409, mesa ya ocupada -> 409 sin cambiar nada,
 * inexistente -> 404, id inválido -> 400 y sin token -> 401.
 */
describe('Reservations: check-in (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const http = () => auth.http();
  const base = '/api/v1/reservations';

  // Dos mesas propias de esta corrida: una libre y otra ya ocupada
  let table: Table;
  let occupiedTable: Table;
  let confirmed: Reservation;
  let pending: Reservation;
  let confirmedOnOccupiedTable: Reservation;

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
    const number = 5_000_000 + (Date.now() % 1_000_000);
    const tables = dataSource.getRepository(Table);
    table = await tables.save({
      number,
      capacity: 4,
      zone: TableZone.INTERIOR,
    });
    occupiedTable = await tables.save({
      number: number + 1,
      capacity: 4,
      zone: TableZone.INTERIOR,
      status: TableStatus.OCCUPIED,
    });

    // Una reserva por cada caso que se va a probar
    const reservations = dataSource.getRepository(Reservation);
    const build = (
      date: string,
      status: ReservationStatus,
      tableId: string,
    ) => ({
      customerName: 'E2E Check-in',
      phone: '3001234567',
      email: 'e2e-checkin@example.com',
      date,
      time: '19:00',
      guests: 2,
      status,
      tableId,
    });

    confirmed = await reservations.save({
      ...build('2099-03-01', ReservationStatus.CONFIRMED, table.id),
      confirmedAt: new Date(),
    });
    pending = await reservations.save(
      build('2099-03-02', ReservationStatus.PENDING, table.id),
    );
    confirmedOnOccupiedTable = await reservations.save({
      ...build('2099-03-03', ReservationStatus.CONFIRMED, occupiedTable.id),
      confirmedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && table && occupiedTable) {
      const ids = [table.id, occupiedTable.id];
      await dataSource.getRepository(Reservation).delete({ tableId: In(ids) });
      await dataSource.getRepository(Table).delete({ id: In(ids) });
    }
    await auth?.cleanup();
    await app?.close();
  });

  it('registra el check-in de una reserva CONFIRMED', async () => {
    const res = await http()
      .patch(`${base}/${confirmed.id}/check-in`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: confirmed.id,
      status: ReservationStatus.CHECKED_IN,
      table: { id: table.id },
    });
    expect(res.body.checkedInAt).not.toBeNull();
  });

  it('deja la mesa OCCUPIED (GET /tables/{id})', async () => {
    const res = await http().get(`/api/v1/tables/${table.id}`).expect(200);

    expect(res.body.status).toBe(TableStatus.OCCUPIED);
  });

  it('rechaza con 409 el check-in de una reserva PENDING', async () => {
    const res = await http()
      .patch(`${base}/${pending.id}/check-in`)
      .expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('rechaza con 409 repetir el check-in de una reserva CHECKED_IN', async () => {
    const res = await http()
      .patch(`${base}/${confirmed.id}/check-in`)
      .expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('rechaza con 409 si la mesa ya está ocupada y no cambia nada', async () => {
    await http()
      .patch(`${base}/${confirmedOnOccupiedTable.id}/check-in`)
      .expect(409);

    // Ambos cambios se aplican o ninguno: la reserva sigue CONFIRMED
    const saved = await dataSource
      .getRepository(Reservation)
      .findOneByOrFail({ id: confirmedOnOccupiedTable.id });

    expect(saved.status).toBe(ReservationStatus.CONFIRMED);
    expect(saved.checkedInAt).toBeNull();
  });

  it('devuelve 404 si la reserva no existe (RN-070)', async () => {
    await http().patch(`${base}/${UNKNOWN_ID}/check-in`).expect(404);
  });

  it('devuelve 400 si el id no es un UUID válido', async () => {
    await http().patch(`${base}/no-es-un-uuid/check-in`).expect(400);
  });

  it('responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${confirmed.id}/check-in`)
      .expect(401);
  });
});
