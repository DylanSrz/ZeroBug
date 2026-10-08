// Reglas de negocio de las reservas. Cada historia añade aquí sus métodos:
// findAvailableTables (HU-006), create (HU-007), findAll/findOne (HU-008)...
// Los parámetros de duración y tolerancia se leen de ConfigService
// (reservations.durationMinutes, reservations.noShowToleranceMinutes), nunca fijos.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity.js';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}
}
