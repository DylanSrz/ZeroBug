import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupApp } from '../src/app.setup.js';

// Controlador y DTO mínimos: prueban la configuración transversal (#30)
// sin depender de módulos de negocio ni de la base de datos.
class ProbeDto {
  @IsString()
  @MinLength(2)
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  capacity: number;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() dto: ProbeDto) {
    return { received: dto, capacityType: typeof dto.capacity };
  }
}

async function createApp(
  corsOrigins: string[],
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app, { corsOrigins });
  await app.init();
  return app;
}

describe('setupApp (ValidationPipe, Helmet, CORS)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp(['http://localhost:5173']);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ValidationPipe global', () => {
    it('acepta un body válido y transforma tipos (transform: true)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'Mesa 1', capacity: '4' })
        .expect(201);

      expect(res.body).toEqual({
        received: { name: 'Mesa 1', capacity: 4 },
        capacityType: 'number',
      });
    });

    it('responde 400 ante un campo desconocido (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'Mesa 1', capacity: 4, hacker: true })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('hacker')]),
      );
    });

    it('responde 400 ante valores inválidos con mensajes por campo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'M', capacity: 0 })
        .expect(400);

      expect(res.body.message).toHaveLength(2);
      expect(res.body.message.join(' ')).toMatch(/name/);
      expect(res.body.message.join(' ')).toMatch(/capacity/);
    });
  });

  describe('Helmet', () => {
    it('añade cabeceras de seguridad', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/probe')
        .send({ name: 'ok', capacity: 1 });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('permite un origen configurado', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/probe')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:5173',
      );
      expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    });

    it('rechaza un origen no configurado', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/probe')
        .set('Origin', 'http://evil.example')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('con "*" permite cualquier origen (modo desarrollo)', async () => {
      const devApp = await createApp(['*']);
      const res = await request(devApp.getHttpServer())
        .options('/api/v1/probe')
        .set('Origin', 'http://cualquiera.local')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://cualquiera.local',
      );
      await devApp.close();
    });
  });
});
