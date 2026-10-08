// Endpoints HTTP de las reservas (/api/v1/reservations). Cada historia añade
// aquí sus rutas y se las pasa al service.

import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service.js';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}
}
