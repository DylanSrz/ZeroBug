import { Controller, Get, INestApplication, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupApp } from '../src/app.setup.js';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../src/common/exceptions/index.js';

@Controller('errors')
class ErrorsController {
  @Get('not-found/:id')
  notFound(@Param('id') id: string) {
    throw new EntityNotFoundException('Mesa', id);
  }

  @Get('conflict')
  conflict() {
    throw new BusinessRuleException('El número de mesa ya existe', 'RN-016');
  }

  @Get('boom')
  boom() {
    throw new Error('fallo inesperado con detalles internos');
  }

  @Get('ok')
  ok() {
    return { ok: true };
  }
}

describe('HttpExceptionFilter (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorsController],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: false,
    });
    setupApp(app, { corsOrigins: ['*'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('404 de dominio con el formato uniforme', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/errors/not-found/42')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Mesa con id 42 no existe',
      path: '/api/v1/errors/not-found/42',
      timestamp: expect.any(String),
    });
  });

  it('409 de regla de negocio incluye la RN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/errors/conflict')
      .expect(409);

    expect(res.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      rule: 'RN-016',
    });
  });

  it('ruta inexistente → 404 con el mismo formato', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/no-existe')
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/no-existe',
    });
  });

  it('error no controlado → 500 sin filtrar detalles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/errors/boom')
      .expect(500);

    expect(res.body).toMatchObject({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    expect(JSON.stringify(res.body)).not.toContain('detalles internos');
  });

  it('las respuestas correctas no se ven afectadas', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/errors/ok')
      .expect(200, { ok: true });
  });
});
