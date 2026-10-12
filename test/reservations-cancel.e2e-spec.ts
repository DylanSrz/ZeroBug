import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';
import { ReservationStatus } from '../src/modules/reservations/enums/index.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableZone } from '../src/modules/tables/enums/index.js';
import { authenticate } from './utils/auth.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-010 contra PostgreSQL real.
 * Cubre: cancelar PENDING y CONFIRMED, cancelledAt, estados que no se
 * cancelan, inexistente, id inválido, token, historial y liberación de la mesa.
 */
describe('Reservations: cancelación (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reservations: Repository<Reservation>;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const base = '/api/v1/reservations';

  // Mesa propia: capacidad rara y fechas de 2099 para aislarse de otros datos
  let table: Table;
  let day = 0;

  // Cada caso usa su propia fecha para que las reservas no se bloqueen entre sí
  const reservationIn = async (status: ReservationStatus) => {
    day += 1;
    return reservations.save({
      customerName: 'E2E Cancelación',
      phone: '3001234567',
      email: 'e2e-cancel@example.com',
      date: `2099-08-${String(day).padStart(2, '0')}`,
      time: '19:00',
      guests: 2,
      status,
      tableId: table.id,
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    auth = await authenticate(app);
    dataSource = app.get(DataSource);
    reservations = dataSource.getRepository(Reservation);

    table = await dataSource.getRepository(Table).save({
      number: 5_000_000 + (Date.now() % 1_000_000),
      capacity: 301,
      zone: TableZone.TERRACE,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && table) {
      await reservations.delete({ tableId: table.id });
      await dataSource.getRepository(Table).delete({ id: table.id });
    }
    await auth?.cleanup();
    await app?.close();
  });

  describe('PATCH /reservations/:id/cancel', () => {
    it.each([ReservationStatus.PENDING, ReservationStatus.CONFIRMED])(
      'cancela una reserva %s y registra cancelledAt (RN-064)',
      async (status) => {
        const reservation = await reservationIn(status);

        const res = await auth
          .http()
          .patch(`${base}/${reservation.id}/cancel`)
          .expect(200);

        expect(res.body.status).toBe(ReservationStatus.CANCELLED);
        expect(res.body.cancelledAt).not.toBeNull();
        expect(res.body.table.id).toBe(table.id);
      },
    );

    it('la reserva cancelada sigue consultable en el historial (RN-062)', async () => {
      const reservation = await reservationIn(ReservationStatus.PENDING);
      await auth.http().patch(`${base}/${reservation.id}/cancel`).expect(200);

      const res = await auth
        .http()
        .get(`${base}/${reservation.id}`)
        .expect(200);
      expect(res.body.status).toBe(ReservationStatus.CANCELLED);
    });

    it('tras cancelar, la mesa vuelve a estar disponible en ese horario (RN-063)', async () => {
      const reservation = await reservationIn(ReservationStatus.CONFIRMED);
      const availability = () =>
        request(app.getHttpServer())
          .get(`${base}/availability`)
          .query({ date: reservation.date, time: '19:00', guests: 301 })
          .expect(200);

      const before = await availability();
      expect(before.body.tables.map((t: Table) => t.id)).not.toContain(
        table.id,
      );

      await auth.http().patch(`${base}/${reservation.id}/cancel`).expect(200);

      const after = await availability();
      expect(after.body.tables.map((t: Table) => t.id)).toContain(table.id);
    });

    it('una reserva ya cancelada responde 409 con RN-060', async () => {
      const reservation = await reservationIn(ReservationStatus.CANCELLED);

      const res = await auth
        .http()
        .patch(`${base}/${reservation.id}/cancel`)
        .expect(409);
      expect(res.body.rule).toBe('RN-060');
    });

    it('una reserva con check-in responde 409 con RN-061', async () => {
      const reservation = await reservationIn(ReservationStatus.CHECKED_IN);

      const res = await auth
        .http()
        .patch(`${base}/${reservation.id}/cancel`)
        .expect(409);
      expect(res.body.rule).toBe('RN-061');
    });

    it('una reserva completada responde 409 (estado final)', async () => {
      const reservation = await reservationIn(ReservationStatus.COMPLETED);

      await auth.http().patch(`${base}/${reservation.id}/cancel`).expect(409);
    });

    it('una reserva inexistente responde 404 (RN-059)', async () => {
      await auth.http().patch(`${base}/${UNKNOWN_ID}/cancel`).expect(404);
    });

    it('un id que no es UUID responde 400', async () => {
      await auth.http().patch(`${base}/abc/cancel`).expect(400);
    });

    it('sin token responde 401', async () => {
      const reservation = await reservationIn(ReservationStatus.PENDING);

      await request(app.getHttpServer())
        .patch(`${base}/${reservation.id}/cancel`)
        .expect(401);
    });
  });
});
