import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessRuleException } from '../../common/exceptions/index.js';
import { Table } from '../tables/entities/table.entity.js';
import { TableStatus } from '../tables/enums/index.js';
import { Reservation } from './entities/reservation.entity.js';
import { CheckAvailabilityDto } from './dto/check-availability.dto.js';
import { RESERVATION_DURATION_MINUTES } from './reservations.constants.js';

// Forma de la respuesta para el endpoint de disponibilidad
export interface AvailabilityResult {
  available: boolean;
  date: string;
  time: string;
  guests: number;
  tables: Pick<Table, 'id' | 'number' | 'capacity' | 'zone'>[];
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,

    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
  ) { }

  // HU-006: Consultar disponibilidad de mesas para una fecha, hora y número de personas.
  async checkAvailability(dto: CheckAvailabilityDto): Promise<AvailabilityResult> {
    // --- Construir el instante de inicio y validar que sea futuro (RN-037) ---
    const startAt = this.buildDateTime(dto.date, dto.time);

    if (startAt <= new Date()) {
      throw new BusinessRuleException(
        'No se puede consultar disponibilidad para una fecha u hora pasada',
        'RN-037',
      );
    }

    // El fin de la reserva se calcula sumando la duración estándar
    const endAt = new Date(startAt.getTime() + RESERVATION_DURATION_MINUTES * 60_000);

    // --- RN-038 + RN-041: solo mesas operativas (status AVAILABLE), descartando OUT_OF_SERVICE ---
    const operationalTables = await this.tableRepository.find({
      where: {
        status: TableStatus.AVAILABLE,
      },
    });


    const suitableTables = operationalTables.filter(
      (t) => t.capacity >= dto.guests, // RN-039
    );

    if (suitableTables.length === 0) {
      return this.buildResponse(dto, false, []);
    }

    // --- RN-040: descartar mesas con reservas que generen conflicto de horario ---
    // Una reserva genera conflicto si su rango (startAt, endAt) se solapa
    // con el rango solicitado. La condición de solapamiento es:
    //   reserva.startAt < endAt solicitado  AND  reserva.endAt > startAt solicitado
    const suitableIds = suitableTables.map((t) => t.id);

    const conflictingTableIds = await this.reservationRepository
      .createQueryBuilder('r')
      .innerJoin('r.table', 'table')
      .select('table.id', 'tableId')
      .where('table.id IN (:...ids)', { ids: suitableIds })
      .andWhere('r.startAt < :endAt', { endAt })
      .andWhere('r.endAt > :startAt', { startAt })
      .getRawMany<{ tableId: string }>();

    const busyIds = new Set(conflictingTableIds.map((row) => row.tableId));


    const availableTables = suitableTables.filter((t) => !busyIds.has(t.id));

    return this.buildResponse(dto, availableTables.length > 0, availableTables);
  }


  /**
   * Combina la fecha (YYYY-MM-DD) y la hora (HH:MM) en un objeto Date.
   * Si el formato de hora es inválido lanza un BusinessRuleException.
   */
  private buildDateTime(date: string, time: string): Date {
    // Validar formato HH:MM
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new BusinessRuleException(
        'El formato de hora debe ser HH:MM (ej. 19:00)',
        'RN-037',
      );
    }

    const combined = new Date(`${date}T${time}:00`);

    if (isNaN(combined.getTime())) {
      throw new BusinessRuleException(
        'La fecha u hora proporcionada no es válida',
        'RN-037',
      );
    }

    return combined;
  }

  /** Construye el objeto de respuesta uniforme del endpoint de disponibilidad. */
  private buildResponse(
    dto: CheckAvailabilityDto,
    available: boolean,
    tables: Table[],
  ): AvailabilityResult {
    return {
      available,
      date: dto.date,
      time: dto.time,
      guests: dto.guests,
      tables: tables.map(({ id, number, capacity, zone }) => ({
        id,
        number,
        capacity,
        zone,
      })),
    };
  }
}
