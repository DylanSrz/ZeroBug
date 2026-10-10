// Endpoints HTTP de las reservas (/api/v1/reservations). Cada historia añade
// aquí sus rutas y se las pasa al service.

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilterReservationsDto } from './dto/filter-reservations.dto.js';
import { ReservationResponseDto } from './dto/reservation-response.dto.js';
import { ReservationsService } from './reservations.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { AvailabilityResponseDto } from './dto/availability-response.dto.js';

@ApiTags('Reservations')
@ApiBearerAuth('bearer')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // GET /api/v1/reservations/availability?date=&time=&guests= (HU-006)
  @Public()
  @Get('availability')
  @ApiOperation({ summary: 'Consultar mesas disponibles' })
  @ApiResponse({ status: 200, type: AvailabilityResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos o fecha pasada',
  })
  findAvailableTables(
    @Query() query: AvailabilityQueryDto,
  ): Promise<AvailabilityResponseDto> {
    return this.reservationsService.findAvailableTables(query);
  }

  // GET /api/v1/reservations?date=&status=&tableId=&page=&limit= (HU-008)
  @Get()
  @ApiOperation({ summary: 'Listar reservas con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Listado de reservas, incluidas canceladas y completadas',
    type: [ReservationResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Filtros inválidos' })
  @ApiResponse({ status: 401, description: 'Falta el token' })
  findAll(
    @Query() filters: FilterReservationsDto,
  ): Promise<ReservationResponseDto[]> {
    return this.reservationsService.findAll(filters);
  }

  // GET /api/v1/reservations/{id} (HU-008)
  // Va al final del controller: así rutas fijas como /reservations/availability
  // (HU-006) no se confunden con un id.
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una reserva con su mesa' })
  @ApiParam({ name: 'id', description: 'UUID de la reserva' })
  @ApiResponse({
    status: 200,
    description: 'Reserva encontrada',
    type: ReservationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'El id no es un UUID' })
  @ApiResponse({ status: 401, description: 'Falta el token' })
  @ApiResponse({ status: 404, description: 'La reserva no existe' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationResponseDto> {
    return this.reservationsService.findOne(id);
  }
}
