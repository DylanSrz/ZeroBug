// Reglas de negocio de las reservas. Cada historia añade aquí sus métodos:
// findAvailableTables (HU-006), create (HU-007), findAll/findOne (HU-008)...
// Los parámetros de duración y tolerancia se leen de ConfigService
// (reservations.durationMinutes, reservations.noShowToleranceMinutes), nunca fijos.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityNotFoundException } from '../../common/exceptions/index.js';
import { FilterReservationsDto } from './dto/filter-reservations.dto.js';
import { ReservationResponseDto } from './dto/reservation-response.dto.js';
import { Reservation } from './entities/reservation.entity.js';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  // HU-008: listado con filtros opcionales y paginación, por fecha y hora.
  // No excluye canceladas ni completadas (RN-051): solo filtra por estado
  // si lo piden en ?status=.
  async findAll(
    filters: FilterReservationsDto,
  ): Promise<ReservationResponseDto[]> {
    const query = this.reservationRepository
      .createQueryBuilder('reservation')
      // LEFT JOIN: también trae las reservas que aún no tienen mesa (RN-050)
      .leftJoinAndSelect('reservation.table', 'table')
      .orderBy('reservation.date', 'ASC')
      .addOrderBy('reservation.time', 'ASC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.date) {
      query.andWhere('reservation.date = :date', { date: filters.date });
    }

    if (filters.status) {
      query.andWhere('reservation.status = :status', {
        status: filters.status,
      });
    }

    if (filters.tableId) {
      query.andWhere('reservation.tableId = :tableId', {
        tableId: filters.tableId,
      });
    }

    const reservations = await query.getMany();
    return reservations.map((reservation) => this.toResponse(reservation));
  }

  // HU-008: una reserva con su mesa. Si no existe, 404 (RN-048).
  async findOne(id: string): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: { table: true },
    });

    if (!reservation) {
      throw new EntityNotFoundException('Reservation', id);
    }

    return this.toResponse(reservation);
  }

  // Convierte la entidad en la respuesta pública: la hora en HH:MM y de la
  // mesa solo su resumen, o null si no tiene (RN-050).
  private toResponse(reservation: Reservation): ReservationResponseDto {
    const { table } = reservation;

    return {
      id: reservation.id,
      customerName: reservation.customerName,
      phone: reservation.phone,
      email: reservation.email,
      date: reservation.date,
      time: reservation.time.slice(0, 5), // PostgreSQL devuelve HH:MM:SS
      guests: reservation.guests,
      status: reservation.status,
      table: table
        ? {
            id: table.id,
            number: table.number,
            zone: table.zone,
            capacity: table.capacity,
          }
        : null,
      confirmedAt: reservation.confirmedAt ?? null,
      checkedInAt: reservation.checkedInAt ?? null,
      cancelledAt: reservation.cancelledAt ?? null,
      noShowAt: reservation.noShowAt ?? null,
      completedAt: reservation.completedAt ?? null,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }
}
