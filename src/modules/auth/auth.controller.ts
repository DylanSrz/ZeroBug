import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/index.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/index.js';
import { LoginDto, LoginResponseDto, RegisterDto } from './dto/index.js';

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un cliente',
    description:
      'Crea una cuenta con rol CUSTOMER y estado ACTIVE. La contraseña se guarda cifrada y nunca se devuelve.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuenta creada',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos: email, teléfono, contraseña débil (RN-083) o confirmación distinta (RN-084)',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una cuenta con ese correo (RN-082)',
  })
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Devuelve un access token JWT para enviar como "Authorization: Bearer <token>". Su vida la fija JWT_EXPIRES_IN.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      cliente: {
        value: { email: 'carlos@example.com', password: 'Password123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Credenciales válidas',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Email o contraseña ausentes' })
  @ApiResponse({
    status: 401,
    description:
      'Credenciales inválidas o cuenta inactiva; el mensaje no indica cuál (RN-091)',
  })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
