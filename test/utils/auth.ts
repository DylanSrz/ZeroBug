import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/users/entities/user.entity.js';
import { UserRole } from '../../src/modules/users/enums/index.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import type { JwtPayload } from '../../src/modules/auth/interfaces/index.js';

/**
 * Para los e2e de endpoints protegidos (RN-094): crea un usuario de prueba
 * con el rol pedido y devuelve un cliente HTTP que ya envía su token.
 *
 *   const auth = await authenticate(app);           // ADMIN por defecto
 *   await auth.http().get('/api/v1/tables').expect(200);
 *   ...
 *   await auth.cleanup();                           // en afterAll
 */
export async function authenticate(
  app: INestApplication<App>,
  role: UserRole = UserRole.ADMIN,
) {
  const user = await app.get(UsersService).create({
    firstName: 'E2E',
    lastName: role,
    email: `e2e-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    phone: '+57 300 000 0000',
    password: 'Password123',
    role,
  });

  const payload: JwtPayload = { sub: user.id, email: user.email, role };
  const token = await app.get(JwtService).signAsync(payload);

  return {
    user,
    token,
    // Cliente que añade "Authorization: Bearer <token>" a cada petición
    http: () =>
      request
        .agent(app.getHttpServer())
        .set('Authorization', `Bearer ${token}`),
    cleanup: () => app.get(DataSource).getRepository(User).delete(user.id),
  };
}
