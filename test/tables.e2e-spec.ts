import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Table } from '../src/modules/tables/entities/table.entity.js';
import { TableStatus, TableZone } from '../src/modules/tables/enums/index.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-002 contra PostgreSQL real.
 * Cubre: crear OK, número duplicado -> 409, capacidad 0 -> 400,
 * listar, filtrar por estado/zona/capacidad, obtener por id, 404,
 * actualizar, cambiar estado, estado inválido -> 400.
 */
describe('Tables (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const base = '/api/v1/tables';
  const http = () => request(app.getHttpServer());

  // `number` es un integer de PostgreSQL (máx. 2.147.483.647), así que no
  // sirve usar Date.now() directamente. Tomamos los últimos dígitos del
  // timestamp para obtener una base única por corrida y dentro del rango.
  const runBase = 1000 + (Date.now() % 1_000_000);
  const testNumber = (offset: number) => runBase + offset;
  const createdTableIds: string[] = [];

  let tableId: string;
  // Se crea en una zona distinta (BAR) a propósito: la necesitan los
  // tests de filtros por zona y capacidad.
  let secondaryTableId: string;

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
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const repo = dataSource.getRepository(Table);
      for (const id of createdTableIds) {
        await repo.delete({ id }).catch(() => undefined);
      }
    }
    await app?.close();
  });

  describe('POST /tables', () => {
    it('crea una mesa correctamente con estado AVAILABLE por defecto (RN-018)', async () => {
      const number = testNumber(1);
      const res = await http()
        .post(base)
        .send({
          number,
          capacity: 4,
          zone: TableZone.INTERIOR,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        number,
        capacity: 4,
        zone: TableZone.INTERIOR,
        status: TableStatus.AVAILABLE,
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();

      tableId = res.body.id;
      createdTableIds.push(tableId);
    });

    // Segunda mesa en otra zona: la necesitan los tests de filtros
    // más abajo (GET /tables), que categories no necesita.
    it('crea una segunda mesa en otra zona (para probar filtros luego)', async () => {
      const number = testNumber(2);
      const res = await http()
        .post(base)
        .send({
          number,
          capacity: 2,
          zone: TableZone.BAR,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        number,
        capacity: 2,
        zone: TableZone.BAR,
        status: TableStatus.AVAILABLE,
      });

      secondaryTableId = res.body.id;
      createdTableIds.push(secondaryTableId);
    });

    it('rechaza un número de mesa duplicado con 409 y RN-016', async () => {
      const number = testNumber(1);
      const res = await http()
        .post(base)
        .send({ number, capacity: 4, zone: TableZone.INTERIOR })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-016',
        path: base,
      });
      expect(res.body.message).toContain(String(number));
    });

    it('rechaza capacity: 0 con 400 (RN-017)', async () => {
      const res = await http()
        .post(base)
        .send({ number: testNumber(3), capacity: 0, zone: TableZone.INTERIOR })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it.each([
      { desc: 'sin number', body: { capacity: 4, zone: TableZone.INTERIOR } },
      {
        desc: 'sin capacity',
        body: { number: testNumber(4), zone: TableZone.INTERIOR },
      },
      {
        desc: 'zona inválida',
        body: { number: testNumber(5), capacity: 4, zone: 'PLAYA' },
      },
      {
        desc: 'number negativo',
        body: { number: -1, capacity: 4, zone: TableZone.INTERIOR },
      },
    ])('rechaza datos inválidos ($desc) con 400 (RN-020)', async ({ body }) => {
      const res = await http().post(base).send(body).expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    // Este test es igual en estructura al de categories, solo cambia
    // 'status' como campo prohibido (en categories igual es 'status',
    // así que aquí no cambió casi nada, solo los datos del body)
    it('rechaza campos no declarados en el DTO con 400', async () => {
      const res = await http()
        .post(base)
        .send({
          number: testNumber(6),
          capacity: 4,
          zone: TableZone.INTERIOR,
          status: TableStatus.OCCUPIED,
        })
        .expect(400);

      expect(res.body.message).toContain('property status should not exist');
    });
  });

  describe('GET /tables', () => {
    it('lista todas las mesas ordenadas por number', async () => {
      const res = await http().get(base).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      const returnedIds = res.body.map((t: Table) => t.id);
      expect(returnedIds).toContain(tableId);
      expect(returnedIds).toContain(secondaryTableId);
    });

    it('filtra mesas por status', async () => {
      const res = await http()
        .get(base)
        .query({ status: TableStatus.AVAILABLE })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const returnedIds = res.body.map((t: Table) => t.id);
      expect(returnedIds).toContain(tableId);
      for (const t of res.body as Table[]) {
        expect(t.status).toBe(TableStatus.AVAILABLE);
      }
    });

    // AGREGADO
    it('filtra mesas por zone', async () => {
      const res = await http()
        .get(base)
        .query({ zone: TableZone.BAR })
        .expect(200);

      const returnedIds = res.body.map((t: Table) => t.id);
      expect(returnedIds).toContain(secondaryTableId);
      expect(returnedIds).not.toContain(tableId);
    });

    // AGREGADO
    it('filtra mesas por capacity mínima', async () => {
      const res = await http().get(base).query({ capacity: 3 }).expect(200);

      const returnedIds = res.body.map((t: Table) => t.id);
      expect(returnedIds).toContain(tableId); // capacity 4
      expect(returnedIds).not.toContain(secondaryTableId); // capacity 2
    });

    // AGREGADO
    it('combina filtros de status, zone y capacity', async () => {
      const res = await http()
        .get(base)
        .query({
          status: TableStatus.AVAILABLE,
          zone: TableZone.INTERIOR,
          capacity: 4,
        })
        .expect(200);

      const returnedIds = res.body.map((t: Table) => t.id);
      expect(returnedIds).toContain(tableId);
      expect(returnedIds).not.toContain(secondaryTableId);
    });
  });

  describe('GET /tables/{id}', () => {
    it('devuelve la mesa consultada por ID', async () => {
      const res = await http().get(`${base}/${tableId}`).expect(200);

      expect(res.body).toMatchObject({
        id: tableId,
        number: testNumber(1),
        capacity: 4,
        zone: TableZone.INTERIOR,
        status: TableStatus.AVAILABLE,
      });
    });

    it('devuelve 404 con formato uniforme si no existe', async () => {
      const res = await http().get(`${base}/${UNKNOWN_ID}`).expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Mesa con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}`,
      });
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http().get(`${base}/id-invalido`).expect(400);
    });
  });

  describe('PATCH /tables/{id}', () => {
    it('actualiza capacity y zone de una mesa', async () => {
      const res = await http()
        .patch(`${base}/${secondaryTableId}`)
        .send({ capacity: 6, zone: TableZone.VIP })
        .expect(200);

      expect(res.body).toMatchObject({
        id: secondaryTableId,
        capacity: 6,
        zone: TableZone.VIP,
      });
    });

    // El caso "no revalida unicidad si number no cambia" ya está cubierto
    // por los tests unitarios de TablesService; aquí no se duplica.
    it('rechaza cambiar el number a uno ya existente con 409 y RN-016', async () => {
      const res = await http()
        .patch(`${base}/${secondaryTableId}`)
        .send({ number: testNumber(1) }) // ya usado por tableId
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-016',
        path: `${base}/${secondaryTableId}`,
      });
    });

    it('devuelve 404 si la mesa a actualizar no existe', async () => {
      const res = await http()
        .patch(`${base}/${UNKNOWN_ID}`)
        .send({ capacity: 5 })
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Mesa con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}`,
      });
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http().patch(`${base}/no-uuid`).send({ capacity: 5 }).expect(400);
    });

    // RN-017 también en el flujo de actualización, no solo al crear.
    it('devuelve 400 si capacity es 0', async () => {
      await http()
        .patch(`${base}/${secondaryTableId}`)
        .send({ capacity: 0 })
        .expect(400);
    });

    // NOTA: categories tiene aquí "no permite cambiar el estado por este
    // endpoint (400 por campo no permitido)" porque UpdateCategoryDto
    // excluye 'status'. UpdateTableDto TAMBIÉN excluye 'status' por el
    // mismo motivo (RN: el estado se cambia por su propio endpoint), así
    // que este caso SÍ aplicaría a mesas — quedó pendiente agregarlo
    // para tener paridad completa. Puedo sumarlo si quieres.
  });

  describe('PATCH /tables/{id}/status', () => {
    it('cambia el estado a OCCUPIED (RN-020)', async () => {
      const res = await http()
        .patch(`${base}/${tableId}/status`)
        .send({ status: TableStatus.OCCUPIED })
        .expect(200);

      expect(res.body).toMatchObject({
        id: tableId,
        status: TableStatus.OCCUPIED,
      });
    });

    it('cambia el estado a OUT_OF_SERVICE', async () => {
      const res = await http()
        .patch(`${base}/${tableId}/status`)
        .send({ status: TableStatus.OUT_OF_SERVICE })
        .expect(200);

      expect(res.body).toMatchObject({
        id: tableId,
        status: TableStatus.OUT_OF_SERVICE,
      });
    });

    it.each(['RESERVED', 'CLOSED', 'invalid', ''])(
      'rechaza estado inválido "%s" con 400 (RN-020)',
      async (invalidStatus) => {
        const res = await http()
          .patch(`${base}/${tableId}/status`)
          .send({ status: invalidStatus })
          .expect(400);

        expect(res.body.statusCode).toBe(400);
        expect(res.body.error).toBe('Bad Request');
      },
    );

    it('devuelve 404 si la mesa a cambiar estado no existe', async () => {
      const res = await http()
        .patch(`${base}/${UNKNOWN_ID}/status`)
        .send({ status: TableStatus.AVAILABLE })
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Mesa con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}/status`,
      });
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http()
        .patch(`${base}/12345/status`)
        .send({ status: TableStatus.AVAILABLE })
        .expect(400);
    });

    it('persiste los cambios en PostgreSQL', async () => {
      await http()
        .patch(`${base}/${tableId}/status`)
        .send({ status: TableStatus.AVAILABLE })
        .expect(200);

      const persisted = await dataSource
        .getRepository(Table)
        .findOneByOrFail({ id: tableId });

      expect(persisted).toMatchObject({
        id: tableId,
        status: TableStatus.AVAILABLE,
      });
    });
  });
});
