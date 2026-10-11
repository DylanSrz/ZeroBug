import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';
import { ReservationStatus } from '../src/modules/reservations/enums/index.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableStatus, TableZone } from '../src/modules/tables/enums/index.js';

/**
 * Criterios de aceptación de HU-006 contra PostgreSQL real.
 * Cubre: solapamiento D-001, estados de mesa, estados de reserva,
 * capacidad insuficiente, fecha pasada y acceso sin token (es público).
 *
 * Truco de aislamiento: capacity=91 y fechas en 2099 para no
 * interferir con datos de otros compañeros en la BD compartida.
 */
describe('Reservations: disponibilidad (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const base = '/api/v1/reservations/availability';

  // Mesa principal con capacity=91 (valor raro, único en la BD)
  let tableMain: Table;
  // Mesa OUT_OF_SERVICE: nunca debe aparecer
  let tableOos: Table;
  // Mesa OCCUPIED: sí debe aparecer (estado presente ≠ bloqueo futuro)
  let tableOccupied: Table;

  // Base única por corrida para los números de mesa (unique en la BD)
  const baseNumber = 3_000_000 + (Date.now() % 1_000_000);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
    dataSource = app.get(DataSource);

    const tables = dataSource.getRepository(Table);
    const reservations = dataSource.getRepository(Reservation);

    // Mesa principal disponible
    tableMain = await tables.save({
      number: baseNumber,
      capacity: 91,
      zone: TableZone.INTERIOR,
    });

    // Mesa fuera de servicio
    tableOos = await tables.save({
      number: baseNumber + 1,
      capacity: 91,
      zone: TableZone.INTERIOR,
      status: TableStatus.OUT_OF_SERVICE,
    });

    // Mesa ocupada (estado presente, no bloquea reservas futuras)
    tableOccupied = await tables.save({
      number: baseNumber + 2,
      capacity: 91,
      zone: TableZone.INTERIOR,
      status: TableStatus.OCCUPIED,
    });

    // Reserva CONFIRMED a las 19:00 en tableMain (ventana 19:00–21:00)
    await reservations.save({
      customerName: 'E2E Disponibilidad',
      phone: '3001234567',
      email: 'e2e-availability@example.com',
      date: '2099-06-15',
      time: '19:00',
      guests: 2,
      status: ReservationStatus.CONFIRMED,
      tableId: tableMain.id,
    });

    // Reserva CANCELLED sola en otra fecha: no debe bloquear tableMain
    await reservations.save({
      customerName: 'E2E Disponibilidad',
      phone: '3001234567',
      email: 'e2e-availability@example.com',
      date: '2099-06-16',
      time: '19:00',
      guests: 2,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      tableId: tableMain.id,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const reservations = dataSource.getRepository(Reservation);
      const tables = dataSource.getRepository(Table);

      if (tableMain) await reservations.delete({ tableId: tableMain.id });
      if (tableOos) await reservations.delete({ tableId: tableOos.id });
      if (tableOccupied)
        await reservations.delete({ tableId: tableOccupied.id });

      if (tableMain) await tables.delete({ id: tableMain.id });
      if (tableOos) await tables.delete({ id: tableOos.id });
      if (tableOccupied) await tables.delete({ id: tableOccupied.id });
    }
    await app?.close();
  });

  describe('GET /reservations/availability', () => {
    it('funciona sin token (endpoint público)', async () => {
      await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '21:00', guests: 1 })
        .expect(200);
    });

    it('CONFIRMED 19:00 → consultar 20:00 no trae tableMain (D-001 solape)', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '20:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).not.toContain(tableMain.id);
    });

    it('CONFIRMED 19:00 → consultar 21:00 sí trae tableMain (no hay solape)', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '21:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).toContain(tableMain.id);
    });

    it('CONFIRMED 19:00 → consultar 17:00 sí trae tableMain (no hay solape)', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '17:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).toContain(tableMain.id);
    });

    it.each(['19:00', '18:00', '17:01', '20:59'])(
      'CONFIRMED 19:00 → consultar %s no trae tableMain (solape exacto o parcial)',
      async (time) => {
        const res = await request(app.getHttpServer())
          .get(base)
          .query({ date: '2099-06-15', time, guests: 1 })
          .expect(200);

        const ids = res.body.tables.map((t: Table) => t.id);
        expect(ids).not.toContain(tableMain.id);
      },
    );

    it('capacidad insuficiente: guests 92 no trae las mesas de 91 (RN-039)', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '12:00', guests: 92 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).not.toContain(tableMain.id);
      expect(ids).not.toContain(tableOccupied.id);
    });

    it('mesa OUT_OF_SERVICE nunca aparece', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '12:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).not.toContain(tableOos.id);
    });

    it('mesa OCCUPIED sí aparece (estado presente, no bloquea futuro)', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '12:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).toContain(tableOccupied.id);
    });

    it('reserva CANCELLED no bloquea: tableMain aparece en su misma franja', async () => {
      // El 2099-06-16 la única reserva de tableMain es CANCELLED a las 19:00
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-16', time: '19:00', guests: 1 })
        .expect(200);

      const ids = res.body.tables.map((t: Table) => t.id);
      expect(ids).toContain(tableMain.id);
    });

    it('guests: 9999 → { available: false, tables: [] }', async () => {
      const res = await request(app.getHttpServer())
        .get(base)
        .query({ date: '2099-06-15', time: '12:00', guests: 9999 })
        .expect(200);

      expect(res.body).toEqual({ available: false, tables: [] });
    });

    it('fecha pasada → 400', async () => {
      await request(app.getHttpServer())
        .get(base)
        .query({ date: '2020-01-01', time: '12:00', guests: 2 })
        .expect(400);
    });
  });
});
