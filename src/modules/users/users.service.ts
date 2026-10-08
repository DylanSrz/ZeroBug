// Cuentas de usuario. Lo usan el registro y el login (auth), y lo usarán
// empleados (HU-016) y perfil (HU-019). Recibe la contraseña en claro y
// guarda solo su hash: nadie más debería tocar passwordHash.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BusinessRuleException } from '../../common/exceptions/index.js';
import { User } from './entities/user.entity.js';
import { UserRole, UserStatus } from './enums/index.js';
import { PasswordService } from './password.service.js';

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}

// Código de PostgreSQL para "violación de restricción única"
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordService: PasswordService,
  ) {}

  // Crea una cuenta ACTIVE (RN-086). Email repetido → 409 (RN-082).
  async create(data: CreateUserData): Promise<User> {
    const email = this.normalizeEmail(data.email);

    if (await this.userRepository.existsBy({ email })) {
      throw this.duplicatedEmail();
    }

    const user = this.userRepository.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      phone: data.phone.trim(),
      passwordHash: await this.passwordService.hash(data.password),
      role: data.role ?? UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });

    try {
      const saved = await this.userRepository.save(user);
      // Lo devolvemos recién leído, sin passwordHash (select: false)
      return await this.userRepository.findOneByOrFail({ id: saved.id });
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw this.duplicatedEmail();
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  // Para el login: incluye passwordHash, que por defecto no se selecciona.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private duplicatedEmail(): BusinessRuleException {
    return new BusinessRuleException(
      'Ya existe una cuenta con ese correo electrónico',
      'RN-082',
    );
  }
}
