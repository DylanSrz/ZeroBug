import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { PasswordService } from '../users/password.service.js';
import { User } from '../users/entities/user.entity.js';
import { UserRole, UserStatus } from '../users/enums/index.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/index.js';

const user: User = {
  id: 'u-1',
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'carlos@example.com',
  phone: '+57 300 123 4567',
  passwordHash: 'scrypt$hash',
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-10-07T12:00:00Z'),
  updatedAt: new Date('2026-10-07T12:00:00Z'),
};

const dto: RegisterDto = {
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'carlos@example.com',
  phone: '+57 300 123 4567',
  password: 'Password123',
  passwordConfirmation: 'Password123',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { create: Mock };

  beforeEach(async () => {
    usersService = { create: vi.fn().mockResolvedValue(user) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: PasswordService,
          useValue: {
            hash: vi.fn().mockResolvedValue('scrypt$dummy'),
            compare: vi.fn(),
          },
        },
        { provide: JwtService, useValue: { signAsync: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('crea siempre un CUSTOMER y no pasa la confirmación a UsersService', async () => {
      await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith({
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: 'carlos@example.com',
        phone: '+57 300 123 4567',
        password: 'Password123',
        role: UserRole.CUSTOMER,
      });
    });

    it('responde sin contraseña ni hash (RN-087)', async () => {
      const res = await service.register(dto);

      expect(res).toEqual({
        id: 'u-1',
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: 'carlos@example.com',
        phone: '+57 300 123 4567',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        createdAt: user.createdAt,
      });
    });
  });
});
