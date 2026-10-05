import { Controller, Get, Query } from '@nestjs/common';
import { ReservationsService } from './reservations.service.js';
import { CheckAvailabilityDto } from './dto/check-availability.dto.js';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) { }

  // GET /api/v1/reservations/availability?date=2026-09-20&time=19:00&guests=4
  // HU-006: Consulta de disponibilidad de mesas
  @Get('availability')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(dto);
  }
}
