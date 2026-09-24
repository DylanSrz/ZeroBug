import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Category } from '../src/modules/categories/entities/category.entity.js';
import { CategoryStatus } from '../src/modules/categories/enums/index.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-003 contra PostgreSQL real.
 * Cubre: Crear OK, nombre duplicado -> 409, listar, obtener, 404,
 * actualizar, activar/desactivar, estado inválido -> 400.
 */
describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const base = '/api/v1/categories';
  const http = () => request(app.getHttpServer());

  const runId = Date.now();
  const testName = (suffix: string) => `e2e-cat-${runId}-${suffix}`;
  const createdCategoryIds: string[] = [];

  let categoryId: string;
  let secondaryCategoryId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const repo = dataSource.getRepository(Category);
      for (const id of createdCategoryIds) {
        await repo.delete({ id }).catch(() => undefined);
      }
    }
    await app?.close();
  });

  describe('POST /categories', () => {
    it('crea una categoría correctamente con estado ACTIVE por defecto (RN-022)', async () => {
      const name = testName('entradas');
      const res = await http()
        .post(base)
        .send({
          name,
          description: 'Platos ligeros para comenzar',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name,
        description: 'Platos ligeros para comenzar',
        status: CategoryStatus.ACTIVE,
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();

      categoryId = res.body.id;
      createdCategoryIds.push(categoryId);
    });

    it('crea una categoría con descripción omitida (opcional)', async () => {
      const name = testName('postres');
      const res = await http().post(base).send({ name }).expect(201);

      expect(res.body).toMatchObject({
        name,
        description: null,
        status: CategoryStatus.ACTIVE,
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);

      secondaryCategoryId = res.body.id;
      createdCategoryIds.push(secondaryCategoryId);
    });

    it('rechaza un nombre duplicado con 409 y RN-021', async () => {
      const name = testName('entradas');
      const res = await http()
        .post(base)
        .send({ name, description: 'Otra descripción' })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-021',
        path: base,
      });
      expect(res.body.message).toContain(name);
    });

    it.each([
      { desc: 'nombre vacío', body: { name: '' } },
      { desc: 'nombre menor a 2 caracteres', body: { name: 'A' } },
      { desc: 'nombre mayor a 50 caracteres', body: { name: 'A'.repeat(51) } },
      { desc: 'sin campo name', body: { description: 'Sin nombre' } },
    ])('rechaza datos inválidos ($desc) con 400', async ({ body }) => {
      const res = await http().post(base).send(body).expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('rechaza campos no declarados en el DTO con 400', async () => {
      const res = await http()
        .post(base)
        .send({
          name: testName('extra'),
          status: CategoryStatus.INACTIVE,
        })
        .expect(400);

      expect(res.body.message).toContain('property status should not exist');
    });
  });

  describe('GET /categories', () => {
    it('lista todas las categorías (activas e inactivas) ordenadas por nombre (RN-023)', async () => {
      const res = await http().get(base).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      const returnedIds = res.body.map((c: Category) => c.id);
      expect(returnedIds).toContain(categoryId);
      expect(returnedIds).toContain(secondaryCategoryId);

      const item = res.body.find((c: Category) => c.id === categoryId);
      expect(item).toMatchObject({
        id: categoryId,
        name: testName('entradas'),
        status: CategoryStatus.ACTIVE,
      });
    });
  });

  describe('GET /categories/{id}', () => {
    it('devuelve la categoría consultada por ID', async () => {
      const res = await http().get(`${base}/${categoryId}`).expect(200);

      expect(res.body).toMatchObject({
        id: categoryId,
        name: testName('entradas'),
        description: 'Platos ligeros para comenzar',
        status: CategoryStatus.ACTIVE,
      });
    });

    it('devuelve 404 con formato uniforme si no existe', async () => {
      const res = await http().get(`${base}/${UNKNOWN_ID}`).expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Categoría con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}`,
      });
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http().get(`${base}/id-invalido`).expect(400);
    });
  });

  describe('PATCH /categories/{id}', () => {
    it('actualiza nombre y descripción de una categoría', async () => {
      const newName = testName('entradas-actualizadas');
      const res = await http()
        .patch(`${base}/${categoryId}`)
        .send({
          name: newName,
          description: 'Entradas frías y calientes actualizadas',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: categoryId,
        name: newName,
        description: 'Entradas frías y calientes actualizadas',
        status: CategoryStatus.ACTIVE,
      });
    });

    it('permite actualizar sin cambiar el nombre (conservando unicidad)', async () => {
      const currentName = testName('entradas-actualizadas');
      const res = await http()
        .patch(`${base}/${categoryId}`)
        .send({
          name: currentName,
          description: 'Descripción retocada',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: categoryId,
        name: currentName,
        description: 'Descripción retocada',
      });
    });

    it('rechaza cambiar el nombre a uno ya existente con 409 y RN-021', async () => {
      const res = await http()
        .patch(`${base}/${categoryId}`)
        .send({ name: testName('postres') })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-021',
        path: `${base}/${categoryId}`,
      });
    });

    it('devuelve 404 si la categoría a actualizar no existe', async () => {
      const res = await http()
        .patch(`${base}/${UNKNOWN_ID}`)
        .send({ name: testName('inexistente') })
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Categoría con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}`,
      });
    });

    it('no permite cambiar el estado por este endpoint (400 por campo no permitido)', async () => {
      const res = await http()
        .patch(`${base}/${categoryId}`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(400);

      expect(res.body.message).toContain('property status should not exist');
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http()
        .patch(`${base}/no-uuid`)
        .send({ name: testName('valido') })
        .expect(400);
    });
  });

  describe('PATCH /categories/{id}/status', () => {
    it('desactiva la categoría a INACTIVE (RN-023, RN-024)', async () => {
      const res = await http()
        .patch(`${base}/${categoryId}/status`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(200);

      expect(res.body).toMatchObject({
        id: categoryId,
        status: CategoryStatus.INACTIVE,
      });
    });

    it('reactiva la categoría a ACTIVE (RN-024)', async () => {
      const res = await http()
        .patch(`${base}/${categoryId}/status`)
        .send({ status: CategoryStatus.ACTIVE })
        .expect(200);

      expect(res.body).toMatchObject({
        id: categoryId,
        status: CategoryStatus.ACTIVE,
      });
    });

    it.each(['DELETED', 'PENDING', 'invalid', ''])(
      'rechaza estado inválido "%s" con 400 (RN-024)',
      async (invalidStatus) => {
        const res = await http()
          .patch(`${base}/${categoryId}/status`)
          .send({ status: invalidStatus })
          .expect(400);

        expect(res.body.statusCode).toBe(400);
        expect(res.body.error).toBe('Bad Request');
      },
    );

    it('devuelve 404 si la categoría a actualizar estado no existe', async () => {
      const res = await http()
        .patch(`${base}/${UNKNOWN_ID}/status`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Categoría con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}/status`,
      });
    });

    it('devuelve 400 si el id no es un UUID válido', async () => {
      await http()
        .patch(`${base}/12345/status`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(400);
    });

    it('persiste los cambios en PostgreSQL', async () => {
      await http()
        .patch(`${base}/${categoryId}/status`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(200);

      const persisted = await dataSource
        .getRepository(Category)
        .findOneByOrFail({ id: categoryId });

      expect(persisted).toMatchObject({
        id: categoryId,
        name: testName('entradas-actualizadas'),
        status: CategoryStatus.INACTIVE,
      });
    });
  });
});
