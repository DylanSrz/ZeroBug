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
 * Criterios de aceptación de HU-009 contra PostgreSQL real.
 * Cubre: modificar contacto manteniendo mesa, reasignar por aumento de guests,
 * sin disponibilidad (409), estados no modificables (409), fecha pasada (400),
 * inexistente (404), id inválido (400) y sin token (401).
 */
describe('Reservations: modificación (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: Awaited<ReturnType<typeof authenticate>>;
  const http = () => auth.http();
  const base = '/api/v1/reservations';

  let smallTable: Table; // capacidad 2
  let largeTable: Table; // capacidad 6
  let pendingReservation: Reservation;
  let cancelledReservation: Reservation;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    auth = await authenticate(app);
    dataSource = app.get(DataSource);

    const tablesRepo = dataSource.getRepository(Table);
    const baseNumber = 6_000_000 + (Date.now() % 1_000_000);

    smallTable = await tablesRepo.save({
      number: baseNumber,
      capacity: 2,
      zone: TableZone.INTERIOR,
    });

    largeTable = await tablesRepo.save({
      number: baseNumber + 1,
      capacity: 6,
      zone: TableZone.INTERIOR,
    });

    const reservationsRepo = dataSource.getRepository(Reservation);

    pendingReservation = await reservationsRepo.save({
      customerName: 'Carlos Pérez',
      phone: '3001234567',
      email: 'carlos@example.com',
      date: '2099-09-10',
      time: '19:00',
      guests: 2,
      status: ReservationStatus.PENDING,
      tableId: smallTable.id,
    });

    cancelledReservation = await reservationsRepo.save({
      customerName: 'Reserva Cancelada',
      phone: '3001234567',
      email: 'cancelada@example.com',
      date: '2099-09-11',
      time: '19:00',
      guests: 2,
      status: ReservationStatus.CANCELLED,
      tableId: smallTable.id,
      cancelledAt: new Date(),
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const resRepo = dataSource.getRepository(Reservation);
      const tablesRepo = dataSource.getRepository(Table);

      for (const table of [smallTable, largeTable].filter(Boolean)) {
        await resRepo.delete({ tableId: table.id });
        await tablesRepo.delete({ id: table.id });
      }
    }
    await auth?.cleanup();
    await app?.close();
  });

  describe('PATCH /reservations/:id', () => {
    it('cambiar contacto (misma mesa) → 200 y conserva la mesa asignada', async () => {
      const res = await http()
        .patch(`${base}/${pendingReservation.id}`)
        .send({
          customerName: 'Carlos M. Pérez',
          phone: '3009876543',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: pendingReservation.id,
        customerName: 'Carlos M. Pérez',
        phone: '3009876543',
        guests: 2,
        status: ReservationStatus.PENDING,
        table: { id: smallTable.id },
      });

      const inDb = await dataSource
        .getRepository(Reservation)
        .findOneByOrFail({ id: pendingReservation.id });
      expect(inDb.customerName).toBe('Carlos M. Pérez');
      expect(inDb.tableId).toBe(smallTable.id);
    });

    it('aumentar guests → 200 y reasigna automáticamente a una mesa con capacidad (RN-056)', async () => {
      const res = await http()
        .patch(`${base}/${pendingReservation.id}`)
        .send({ guests: 5 })
        .expect(200);

      expect(res.body).toMatchObject({
        id: pendingReservation.id,
        guests: 5,
        table: { id: largeTable.id },
      });

      const inDb = await dataSource
        .getRepository(Reservation)
        .findOneByOrFail({ id: pendingReservation.id });
      expect(inDb.guests).toBe(5);
      expect(inDb.tableId).toBe(largeTable.id);
    });

    it('sin disponibilidad de mesa responde 409 con RN-058 y no modifica nada', async () => {
      const res = await http()
        .patch(`${base}/${pendingReservation.id}`)
        .send({ guests: 9999 })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-058',
      });

      const inDb = await dataSource
        .getRepository(Reservation)
        .findOneByOrFail({ id: pendingReservation.id });
      expect(inDb.guests).toBe(5); // conserva el valor anterior
    });

    it('modificar una reserva en estado CANCELLED responde 409 con RN-057', async () => {
      const res = await http()
        .patch(`${base}/${cancelledReservation.id}`)
        .send({ customerName: 'Intento de Cambio' })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-057',
      });
    });

    it('fecha pasada responde 400 con RN-053', async () => {
      const res = await http()
        .patch(`${base}/${pendingReservation.id}`)
        .send({ date: '2020-01-01', time: '19:00' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        rule: 'RN-053',
      });
    });

    it('reserva inexistente responde 404 (RN-052)', async () => {
      await http()
        .patch(`${base}/${UNKNOWN_ID}`)
        .send({ customerName: 'No existe' })
        .expect(404);
    });

    it('id que no es UUID responde 400', async () => {
      await http()
        .patch(`${base}/no-es-un-uuid`)
        .send({ customerName: 'UUID inválido' })
        .expect(400);
    });

    it('sin token responde 401', async () => {
      await request(app.getHttpServer())
        .patch(`${base}/${pendingReservation.id}`)
        .send({ customerName: 'Sin autenticar' })
        .expect(401);
    });
  });
});
