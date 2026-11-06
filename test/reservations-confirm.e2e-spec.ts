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
 * Criterios de aceptación de HU-011 contra PostgreSQL real.
 * Cubre: confirmar una PENDING, CONFIRMED y CANCELLED -> 409, id inexistente
 * -> 404, id que no es UUID -> 400 y sin token -> 401.
 */
describe('Reservations: confirmación (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const http = () => auth.http();
  const base = '/api/v1/reservations';

  // Mesa propia de esta corrida: las reservas de estos tests cuelgan de ella
  // y se borran al final.
  let table: Table;
  let pending: Reservation;
  let alreadyConfirmed: Reservation;
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
      number: 4_000_000 + (Date.now() % 1_000_000),
      capacity: 4,
      zone: TableZone.INTERIOR,
    });

    // Una reserva por cada estado que se va a probar
    const reservations = dataSource.getRepository(Reservation);
    const build = (date: string, status: ReservationStatus) => ({
      customerName: 'E2E Confirmación',
      phone: '3001234567',
      email: 'e2e-confirmacion@example.com',
      date,
      time: '19:00',
      guests: 2,
      status,
      tableId: table.id,
    });

    pending = await reservations.save(
      build('2099-02-01', ReservationStatus.PENDING),
    );
    alreadyConfirmed = await reservations.save({
      ...build('2099-02-02', ReservationStatus.CONFIRMED),
      confirmedAt: new Date(),
    });
    cancelled = await reservations.save({
      ...build('2099-02-03', ReservationStatus.CANCELLED),
      cancelledAt: new Date(),
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

  it('confirma una reserva PENDING y conserva su mesa', async () => {
    const res = await http().patch(`${base}/${pending.id}/confirm`).expect(200);

    expect(res.body).toMatchObject({
      id: pending.id,
      status: ReservationStatus.CONFIRMED,
      table: { id: table.id },
    });
    expect(res.body.confirmedAt).not.toBeNull();
  });

  it('deja el cambio guardado en PostgreSQL', async () => {
    const saved = await dataSource
      .getRepository(Reservation)
      .findOneByOrFail({ id: pending.id });

    expect(saved.status).toBe(ReservationStatus.CONFIRMED);
    expect(saved.confirmedAt).not.toBeNull();
    expect(saved.tableId).toBe(table.id);
  });

  it('rechaza con 409 confirmar una reserva ya CONFIRMED', async () => {
    const res = await http()
      .patch(`${base}/${alreadyConfirmed.id}/confirm`)
      .expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('rechaza con 409 confirmar una reserva CANCELLED', async () => {
    const res = await http()
      .patch(`${base}/${cancelled.id}/confirm`)
      .expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('devuelve 404 si la reserva no existe (RN-065)', async () => {
    await http().patch(`${base}/${UNKNOWN_ID}/confirm`).expect(404);
  });

  it('devuelve 400 si el id no es un UUID válido', async () => {
    await http().patch(`${base}/no-es-un-uuid/confirm`).expect(400);
  });

  it('responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${pending.id}/confirm`)
      .expect(401);
  });
});
