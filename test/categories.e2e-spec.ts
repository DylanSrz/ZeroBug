import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
// CAMBIO: importamos Table y sus enums en vez de Category/CategoryStatus
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

  const runId = Date.now();
  // CAMBIO: testName(suffix) generaba strings ("e2e-cat-123-entradas")
  // porque el campo único de categories es 'name' (texto).
  // Mesas usa 'number' (entero) como campo único, así que en vez de
  // texto generamos números únicos sumando un offset al timestamp.
  const testNumber = (offset: number) => runId + offset;
  const createdTableIds: string[] = [];

  let tableId: string;
  // AGREGADO: en categories, secondaryCategoryId solo sirve para probar
  // el 409 de nombre duplicado. Aquí también la usamos para eso, PERO
  // además la creamos en una zona DISTINTA (BAR) a propósito, porque
  // la necesitamos para los tests de filtros que categories no tiene.
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

    // CAMBIO: categories tiene aquí "crea una categoría con descripción
    // omitida (opcional)" porque 'description' es opcional en su DTO.
    // CreateTableDto NO tiene ningún campo opcional (number, capacity y
    // zone son todos obligatorios), así que ese caso no aplica a mesas.
    // En su lugar, usamos esta segunda mesa para los tests de FILTROS
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
        rule: 'RN-016', // CAMBIO: RN-021 (categories) -> RN-016 (mesas)
        path: base,
      });
      expect(res.body.message).toContain(String(number)); // CAMBIO: number en vez de name, por eso String()
    });

    // AGREGADO: este test no tiene equivalente en categories.
    // Es una regla de negocio específica de mesas (RN-017: capacidad > 0).
    it('rechaza capacity: 0 con 400 (RN-017)', async () => {
      const res = await http()
        .post(base)
        .send({ number: testNumber(3), capacity: 0, zone: TableZone.INTERIOR })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    // CAMBIO: los 4 casos del it.each de categories (nombre vacío, muy
    // corto, muy largo, sin campo) se adaptaron a los campos y reglas
    // de mesas: sin number, sin capacity, zona inválida, number negativo.
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

    // AGREGADO: filtro por status. Categories no tiene filtros en su
    // GET /categories (siempre devuelve todas). La HU de mesas SÍ pide
    // filtrar, así que estos 4 tests (status, zone, capacity, combinado)
    // son nuevos y no existen en categories.
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
        message: `Mesa con id ${UNKNOWN_ID} no existe`, // CAMBIO: "Mesa" en vez de "Categoría"
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

    // CAMBIO: en categories este test es "permite actualizar sin cambiar
    // el nombre". Para mesas, el caso equivalente ("no revalida unicidad
    // si number no cambia") ya está cubierto por los tests UNITARIOS de
    // TableService, así que no lo duplicamos aquí a nivel e2e.
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

    // AGREGADO: no tiene equivalente en categories. Verifica RN-017
    // también en el flujo de actualización, no solo en la creación.
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

    // AGREGADO: categories solo alterna entre 2 estados (ACTIVE/INACTIVE).
    // Mesas tiene 3 estados, así que agregamos este test extra para
    // cubrir la transición a OUT_OF_SERVICE que categories no tiene.
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

    // CAMBIO: los valores inválidos de prueba (DELETED, PENDING) se
    // adaptaron a estados que "suenan creíbles" para mesas (RESERVED, CLOSED)
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
