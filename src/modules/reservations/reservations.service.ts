// Reglas de negocio de las reservas. Cada historia añade aquí sus métodos:
// findAvailableTables (HU-006), create (HU-007), findAll/findOne (HU-008)...
// Los parámetros de duración y tolerancia se leen de ConfigService
// (reservations.durationMinutes, reservations.noShowToleranceMinutes), nunca fijos.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EntityNotFoundException } from '../../common/exceptions/index.js';
import { FilterReservationsDto } from './dto/filter-reservations.dto.js';
import { ReservationResponseDto } from './dto/reservation-response.dto.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { AvailabilityResponseDto } from './dto/availability-response.dto.js';
import { Reservation } from './entities/reservation.entity.js';
import { BLOCKING_STATUSES } from './enums/index.js';
import { Table } from '../tables/entities/table.entity.js';
import { TableStatus } from '../tables/enums/index.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly config: ConfigService,
  ) { }



  // HU-006: devuelve las mesas con capacidad >= guests que no tengan ninguna
  // reserva activa que se solape con la ventana [time, time + durationMinutes).
  // El manager por defecto sale del reservationRepository, lo que permite a
  // Dilant llamar a este método dentro de una transacción ya abierta.
  async findAvailableTables(
    query: AvailabilityQueryDto,
    manager: EntityManager = this.reservationRepository.manager,
  ): Promise<AvailabilityResponseDto> {
    // Inicio de la ventana solicitada como string 'YYYY-MM-DD HH:mm'
    const start = `${query.date} ${query.time}`;
    // Duración en minutos leída de config (nunca hardcodeada)
    const duration = this.config.getOrThrow<number>('reservations.durationMinutes');

    const tables = await manager
      .getRepository(Table)
      .createQueryBuilder('t')
      // Excluye solo OUT_OF_SERVICE: OCCUPIED es estado presente,
      // no impide reservar la mesa para el futuro
      .where('t.status != :outOfService', { outOfService: TableStatus.OUT_OF_SERVICE })
      // La mesa debe tener capacidad suficiente
      .andWhere('t.capacity >= :guests', { guests: query.guests })
      // NOT EXISTS: no existe reserva bloqueante que se solape con la ventana
      .andWhere((qb) => {
        const conflict = qb
          .subQuery()
          .select('1')
          .from(Reservation, 'r')
          .where('r.tableId = t.id')
          // Solo reservas activas bloquean (PENDING, CONFIRMED, CHECKED_IN)
          .andWhere('r.status IN (:...blocking)')

          .andWhere(
            '(r.date + r.time) < CAST(:start AS timestamp) + make_interval(mins => :duration)',
          )
          .andWhere(
            'CAST(:start AS timestamp) < (r.date + r.time) + make_interval(mins => :duration)',
          )
          .getQuery();
        return `NOT EXISTS ${conflict}`;
      })
      .setParameters({ blocking: [...BLOCKING_STATUSES], start, duration })
      // Capacidad ascendente: la primera mesa es la más ajustada (Dilant asigna esa)
      .orderBy('t.capacity', 'ASC')
      .addOrderBy('t.number', 'ASC')
      .getMany();

    return {
      available: tables.length > 0,
      tables: tables.map(({ id, number, zone, capacity }) => ({
        id,
        number,
        zone,
        capacity,
      })),
    };
  }

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
      // desempate: sin él, la paginación puede repetir u omitir reservas de la misma hora
      .addOrderBy('reservation.id', 'ASC')
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
