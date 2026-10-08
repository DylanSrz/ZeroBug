// Registro e inicio de sesión. Las cuentas y las contraseñas las gestiona
// UsersService; aquí solo vive el flujo de autenticación.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { PasswordService } from '../users/password.service.js';
import { UserRole, UserStatus } from '../users/enums/index.js';
import { UserResponseDto } from '../users/dto/index.js';
import { LoginDto, LoginResponseDto, RegisterDto } from './dto/index.js';
import type { JwtPayload } from './interfaces/index.js';

// Mismo mensaje para email inexistente, contraseña incorrecta o cuenta
// inactiva: no revela cuál de las tres falló (RN-091)
const INVALID_CREDENTIALS = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  // Hash de una contraseña que nadie conoce. Se compara contra él cuando el
  // email no existe, para que esa respuesta tarde lo mismo que una contraseña
  // incorrecta y no sirva para averiguar qué correos están registrados.
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {
    this.dummyHash = this.passwordService.hash(crypto.randomUUID());
  }

  // Registro público: siempre crea un CUSTOMER ACTIVE (RN-086). El rol no se
  // acepta desde el body; los empleados se dan de alta en HU-016.
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      role: UserRole.CUSTOMER,
    });
    return UserResponseDto.from(user);
  }

  // RN-088 … RN-093
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );

    if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }
}
