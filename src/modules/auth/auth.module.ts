import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { expirationToSeconds } from './jwt-expiration.js';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Secreto y expiración desde el entorno (RN-092); validados en el esquema zod
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: expirationToSeconds(
            config.getOrThrow<string>('jwt.expiresIn'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // JWT obligatorio en toda la API salvo @Public() (RN-094)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Permisos por rol (@Roles). Debe ir después de JwtAuthGuard: los guards
    // globales se ejecutan en el orden en que se registran (RN-101, RN-102)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
