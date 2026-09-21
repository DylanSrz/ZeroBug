import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Category } from '../src/modules/categories/entities/category.entity.js';
import { Product } from '../src/modules/products/entities/product.entity.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-004 contra PostgreSQL real.
 * Cada corrida crea su propia categoría y borra todo lo que creó al final.
 */
describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryId: string;
  let productId: string;

  const base = '/api/v1/products';
  const http = () => request(app.getHttpServer());

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
    const category = await dataSource
      .getRepository(Category)
      .save({ name: `e2e-hamburguesas-${Date.now()}` });
    categoryId = category.id;
  });

  afterAll(async () => {
    await dataSource.getRepository(Product).delete({ categoryId });
    await dataSource.getRepository(Category).delete({ id: categoryId });
    await app.close();
  });

  describe('POST /products', () => {
    it('crea un producto asociado a su categoría, ACTIVE y AVAILABLE (RN-025/027/028)', async () => {
      const res = await http()
        .post(base)
        .send({ name: 'Hamburguesa Clásica', price: 25000.5, categoryId })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Hamburguesa Clásica',
        description: null,
        price: 25000.5,
        categoryId,
        status: 'ACTIVE',
        availability: 'AVAILABLE',
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      productId = res.body.id;
    });

    it('rechaza una categoría inexistente con 409 y RN-025', async () => {
      const res = await http()
        .post(base)
        .send({ name: 'Pasta Alfredo', price: 32000, categoryId: UNKNOWN_ID })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        rule: 'RN-025',
        path: base,
      });
    });

    it.each([0, -5])('rechaza precio %s con 400 (RN-026)', async (price) => {
      const res = await http()
        .post(base)
        .send({ name: 'Limonada', price, categoryId })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('price')]),
      );
    });

    it('rechaza un nombre repetido dentro de la misma categoría con 409', async () => {
      await http()
        .post(base)
        .send({ name: 'Hamburguesa Clásica', price: 1, categoryId })
        .expect(409);
    });

    it('rechaza campos no declarados en el DTO con 400', async () => {
      const res = await http()
        .post(base)
        .send({
          name: 'Cheesecake',
          price: 12000,
          categoryId,
          status: 'INACTIVE',
        })
        .expect(400);

      expect(res.body.message).toContain('property status should not exist');
    });
  });

  describe('GET /products', () => {
    it('lista los productos con su categoría', async () => {
      const res = await http()
        .get(`${base}?categoryId=${categoryId}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: productId,
        category: { id: categoryId, status: 'ACTIVE' },
      });
    });

    it('filtra por disponibilidad', async () => {
      const res = await http()
        .get(`${base}?categoryId=${categoryId}&availability=UNAVAILABLE`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('rechaza un filtro fuera del enum con 400', async () => {
      await http().get(`${base}?status=DELETED`).expect(400);
    });
  });

  describe('GET /products/{id}', () => {
    it('devuelve el producto con su categoría', async () => {
      const res = await http().get(`${base}/${productId}`).expect(200);

      expect(res.body).toMatchObject({
        id: productId,
        name: 'Hamburguesa Clásica',
        category: { id: categoryId },
      });
    });

    it('404 con formato uniforme si no existe', async () => {
      const res = await http().get(`${base}/${UNKNOWN_ID}`).expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Producto con id ${UNKNOWN_ID} no existe`,
        path: `${base}/${UNKNOWN_ID}`,
      });
    });

    it('400 si el id no es un uuid', async () => {
      await http().get(`${base}/abc`).expect(400);
    });
  });

  describe('PATCH /products/{id}', () => {
    it('actualiza precio y descripción', async () => {
      const res = await http()
        .patch(`${base}/${productId}`)
        .send({ price: 27000, description: 'Con queso cheddar' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: productId,
        price: 27000,
        description: 'Con queso cheddar',
        name: 'Hamburguesa Clásica',
      });
    });

    it('rechaza cambiar a una categoría inexistente con 409', async () => {
      await http()
        .patch(`${base}/${productId}`)
        .send({ categoryId: UNKNOWN_ID })
        .expect(409);
    });

    it('no permite cambiar status ni availability por este endpoint', async () => {
      await http()
        .patch(`${base}/${productId}`)
        .send({ status: 'INACTIVE' })
        .expect(400);
    });
  });

  describe('PATCH /products/{id}/status y /availability', () => {
    it('desactiva el producto (RN-029)', async () => {
      const res = await http()
        .patch(`${base}/${productId}/status`)
        .send({ status: 'INACTIVE' })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'INACTIVE',
        availability: 'AVAILABLE',
      });
    });

    it('marca el producto como no disponible sin tocar el estado (RN-030)', async () => {
      const res = await http()
        .patch(`${base}/${productId}/availability`)
        .send({ availability: 'UNAVAILABLE' })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'INACTIVE',
        availability: 'UNAVAILABLE',
      });
    });

    it('rechaza valores fuera del enum con 400', async () => {
      await http()
        .patch(`${base}/${productId}/availability`)
        .send({ availability: 'soldout' })
        .expect(400);
    });

    it('404 si el producto no existe', async () => {
      await http()
        .patch(`${base}/${UNKNOWN_ID}/status`)
        .send({ status: 'ACTIVE' })
        .expect(404);
    });

    it('los cambios quedan persistidos en PostgreSQL', async () => {
      const stored = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: productId });

      expect(stored).toMatchObject({
        status: 'INACTIVE',
        availability: 'UNAVAILABLE',
        price: 27000,
      });
    });
  });
});
