import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { Category } from '../src/modules/categories/entities/category.entity.js';
import { CategoryStatus } from '../src/modules/categories/enums/index.js';
import { Product } from '../src/modules/products/entities/product.entity.js';
import {
  ProductAvailability,
  ProductStatus,
} from '../src/modules/products/enums/index.js';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Criterios de aceptación de HU-005 (menú público) contra PostgreSQL real.
 *
 * Datos de la corrida: 2 categorías (una INACTIVE) y 4 productos
 * (uno INACTIVE y uno UNAVAILABLE), para poder distinguir las tres reglas
 * que se confunden con facilidad:
 *   RN-031 categoría INACTIVE  → no aparece
 *   RN-032 producto  INACTIVE  → no aparece
 *   RN-033 producto  UNAVAILABLE → SÍ aparece, marcado como no disponible
 */
describe('Menu (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const base = '/api/v1/menu';
  const http = () => request(app.getHttpServer());

  const runId = Date.now();
  const named = (suffix: string) => `e2e-menu-${runId}-${suffix}`;

  let activeCategoryId: string;
  let inactiveCategoryId: string;
  let availableProductId: string;
  let unavailableProductId: string;
  let inactiveProductId: string;
  let productOfInactiveCategoryId: string;

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
    const categories = dataSource.getRepository(Category);
    const products = dataSource.getRepository(Product);

    const activa = await categories.save({ name: named('activa') });
    const inactiva = await categories.save({
      name: named('inactiva'),
      status: CategoryStatus.INACTIVE,
    });
    activeCategoryId = activa.id;
    inactiveCategoryId = inactiva.id;

    const disponible = await products.save({
      name: named('disponible'),
      price: 25000,
      categoryId: activa.id,
    });
    const agotado = await products.save({
      name: named('agotado'),
      price: 18000,
      categoryId: activa.id,
      availability: ProductAvailability.UNAVAILABLE,
    });
    const retirado = await products.save({
      name: named('retirado'),
      price: 12000,
      categoryId: activa.id,
      status: ProductStatus.INACTIVE,
    });
    const oculto = await products.save({
      name: named('oculto'),
      price: 9000,
      categoryId: inactiva.id,
    });

    availableProductId = disponible.id;
    unavailableProductId = agotado.id;
    inactiveProductId = retirado.id;
    productOfInactiveCategoryId = oculto.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const products = dataSource.getRepository(Product);
      await products.delete({ categoryId: activeCategoryId });
      await products.delete({ categoryId: inactiveCategoryId });
      await dataSource
        .getRepository(Category)
        .delete([activeCategoryId, inactiveCategoryId]);
    }
    await app?.close();
  });

  describe('GET /menu', () => {
    it('solo incluye categorías ACTIVE (RN-031)', async () => {
      const res = await http().get(base).expect(200);

      const ids = res.body.categories.map((c: Category) => c.id);
      expect(ids).toContain(activeCategoryId);
      expect(ids).not.toContain(inactiveCategoryId);
    });

    it('solo incluye productos ACTIVE, y el UNAVAILABLE aparece marcado (RN-032, RN-033)', async () => {
      const res = await http().get(base).expect(200);

      const categoria = res.body.categories.find(
        (c: Category) => c.id === activeCategoryId,
      );
      const productos: { id: string; availability: string }[] =
        categoria.products;
      const ids = productos.map((p) => p.id);

      expect(ids).toContain(availableProductId);
      expect(ids).toContain(unavailableProductId);
      expect(ids).not.toContain(inactiveProductId);

      const agotado = productos.find((p) => p.id === unavailableProductId);
      expect(agotado?.availability).toBe(ProductAvailability.UNAVAILABLE);

      const disponible = productos.find((p) => p.id === availableProductId);
      expect(disponible?.availability).toBe(ProductAvailability.AVAILABLE);
    });

    it('los productos se muestran dentro de su categoría (RN-034)', async () => {
      const res = await http().get(base).expect(200);

      const categoria = res.body.categories.find(
        (c: Category) => c.id === activeCategoryId,
      );
      expect(categoria).toMatchObject({ name: named('activa') });
      expect(
        categoria.products.every(
          (p: { categoryId: string }) => p.categoryId === activeCategoryId,
        ),
      ).toBe(true);
    });
  });

  describe('GET /menu/categories', () => {
    it('devuelve solo las categorías activas, sin productos', async () => {
      const res = await http().get(`${base}/categories`).expect(200);

      const ids = res.body.map((c: Category) => c.id);
      expect(ids).toContain(activeCategoryId);
      expect(ids).not.toContain(inactiveCategoryId);
      expect(res.body[0]).not.toHaveProperty('products');
    });
  });

  describe('GET /menu/categories/{categoryId}/products', () => {
    it('devuelve los productos activos de una categoría activa', async () => {
      const res = await http()
        .get(`${base}/categories/${activeCategoryId}/products`)
        .expect(200);

      const ids = res.body.map((p: Product) => p.id);
      expect(ids).toEqual(
        expect.arrayContaining([availableProductId, unavailableProductId]),
      );
      expect(ids).not.toContain(inactiveProductId);
    });

    it('404 si la categoría está INACTIVE (RN-031)', async () => {
      const res = await http()
        .get(`${base}/categories/${inactiveCategoryId}/products`)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: `Categoría con id ${inactiveCategoryId} no existe`,
      });
    });

    it('404 si la categoría no existe', async () => {
      await http().get(`${base}/categories/${UNKNOWN_ID}/products`).expect(404);
    });

    it('400 si el id no es un UUID válido', async () => {
      await http().get(`${base}/categories/no-uuid/products`).expect(400);
    });
  });

  describe('GET /menu/products/{id}', () => {
    it('devuelve el detalle de un producto activo', async () => {
      const res = await http()
        .get(`${base}/products/${availableProductId}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: availableProductId,
        name: named('disponible'),
        price: 25000,
        categoryId: activeCategoryId,
        availability: ProductAvailability.AVAILABLE,
      });
    });

    it('un producto UNAVAILABLE se consulta y se marca como no disponible (RN-033)', async () => {
      const res = await http()
        .get(`${base}/products/${unavailableProductId}`)
        .expect(200);

      expect(res.body.availability).toBe(ProductAvailability.UNAVAILABLE);
    });

    it('404 si el producto está INACTIVE (RN-032)', async () => {
      await http().get(`${base}/products/${inactiveProductId}`).expect(404);
    });

    it('404 si su categoría está INACTIVE (RN-031)', async () => {
      await http()
        .get(`${base}/products/${productOfInactiveCategoryId}`)
        .expect(404);
    });

    it('404 si el producto no existe', async () => {
      await http().get(`${base}/products/${UNKNOWN_ID}`).expect(404);
    });

    it('400 si el id no es un UUID válido', async () => {
      await http().get(`${base}/products/no-uuid`).expect(400);
    });
  });

  describe('RN-035: el menú refleja los cambios de administración', () => {
    it('desactivar un producto lo saca del menú en la siguiente consulta', async () => {
      const products = dataSource.getRepository(Product);

      await http()
        .patch(`/api/v1/products/${availableProductId}/status`)
        .send({ status: ProductStatus.INACTIVE })
        .expect(200);

      const res = await http().get(base).expect(200);
      const categoria = res.body.categories.find(
        (c: Category) => c.id === activeCategoryId,
      );
      expect(categoria.products.map((p: Product) => p.id)).not.toContain(
        availableProductId,
      );

      // se restaura para no depender del orden de ejecución
      await products.update(availableProductId, {
        status: ProductStatus.ACTIVE,
      });
    });

    it('desactivar una categoría la saca del menú en la siguiente consulta', async () => {
      const categories = dataSource.getRepository(Category);

      await http()
        .patch(`/api/v1/categories/${activeCategoryId}/status`)
        .send({ status: CategoryStatus.INACTIVE })
        .expect(200);

      const res = await http().get(base).expect(200);
      expect(res.body.categories.map((c: Category) => c.id)).not.toContain(
        activeCategoryId,
      );

      await categories.update(activeCategoryId, {
        status: CategoryStatus.ACTIVE,
      });
    });
  });
});
