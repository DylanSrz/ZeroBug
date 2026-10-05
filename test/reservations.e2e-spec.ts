import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableStatus, TableZone } from '../src/modules/tables/enums/index.js';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity.js';

describe('Reservations (e2e) - HU-006 Availability Check', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const base = '/api/v1/reservations/availability';
  const http = () => request(app.getHttpServer());

  const createdTableIds: string[] = [];
  const createdReservationIds: string[] = [];

  let availableTable: Table;
  let occupiedTable: Table;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();

    dataSource = app.get(DataSource);
    const tableRepo = dataSource.getRepository(Table);
    const reservationRepo = dataSource.getRepository(Reservation);

    // Crear mesas de prueba
    const runBase = 5000 + (Date.now() % 10_000);

    availableTable = await tableRepo.save(
      tableRepo.create({
        number: runBase + 1,
        capacity: 4,
        zone: TableZone.INTERIOR,
        status: TableStatus.AVAILABLE,
      }),
    );
    createdTableIds.push(availableTable.id);

    occupiedTable = await tableRepo.save(
      tableRepo.create({
        number: runBase + 2,
        capacity: 4,
        zone: TableZone.TERRACE,
        status: TableStatus.OCCUPIED,
      }),
    );
    createdTableIds.push(occupiedTable.id);

    // Crear una reserva existente en la mesa availableTable para el 2028-06-15 a las 19:00 (19:00 a 21:00)
    const startAt = new Date('2028-06-15T19:00:00');
    const endAt = new Date('2028-06-15T21:00:00');

    const reservation = await reservationRepo.save(
      reservationRepo.create({
        table: availableTable,
        startAt,
        endAt,
      }),
    );
    createdReservationIds.push(reservation.id);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const reservationRepo = dataSource.getRepository(Reservation);
      for (const id of createdReservationIds) {
        await reservationRepo.delete({ id }).catch(() => undefined);
      }
      const tableRepo = dataSource.getRepository(Table);
      for (const id of createdTableIds) {
        await tableRepo.delete({ id }).catch(() => undefined);
      }
    }
    await app?.close();
  });

  describe('GET /reservations/availability', () => {
    it('retorna disponibilidad exitosa para fecha y hora sin conflicto', async () => {
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15', time: '12:00', guests: 2 })
        .expect(200);

      expect(res.body).toMatchObject({
        available: true,
        date: '2028-06-15',
        time: '12:00',
        guests: 2,
      });

      expect(Array.isArray(res.body.tables)).toBe(true);
      const returnedTableIds = res.body.tables.map((t: any) => t.id);
      expect(returnedTableIds).toContain(availableTable.id);
      // La mesa ocupada (status != AVAILABLE) no debe incluirse
      expect(returnedTableIds).not.toContain(occupiedTable.id);
    });

    it('descarta la mesa si existe conflicto de reservación en el horario solicitado', async () => {
      // Solicitamos a las 19:30 (la reserva existente va de 19:00 a 21:00)
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15', time: '19:30', guests: 2 })
        .expect(200);

      const returnedTableIds = res.body.tables.map((t: any) => t.id);
      expect(returnedTableIds).not.toContain(availableTable.id);
    });

    it('descarta mesas cuya capacidad sea menor que el número de personas', async () => {
      // Solicitamos para 10 personas, disponibleTable tiene capacidad 4
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15', time: '12:00', guests: 10 })
        .expect(200);

      const returnedTableIds = res.body.tables.map((t: any) => t.id);
      expect(returnedTableIds).not.toContain(availableTable.id);
    });

    it('rechaza consultas con fecha u hora en el pasado con BusinessRuleException (RN-037)', async () => {
      const res = await http()
        .get(base)
        .query({ date: '2020-01-01', time: '12:00', guests: 2 })
        .expect(409);

      expect(res.body.rule).toBe('RN-037');
      expect(res.body.message).toContain('pasada');
    });


    it('rechaza params faltantes con 400 Bad Request', async () => {
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('rechaza guests = 0 con 400 Bad Request', async () => {
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15', time: '12:00', guests: 0 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('rechaza campos desconocidos en query params con 400 Bad Request', async () => {
      const res = await http()
        .get(base)
        .query({ date: '2028-06-15', time: '12:00', guests: 4, guest: 4 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('property guest should not exist');
    });
  });
});
