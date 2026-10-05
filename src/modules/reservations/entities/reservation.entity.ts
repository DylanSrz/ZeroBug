import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Table } from '../../tables/entities/table.entity.js';

// Entidad mínima para HU-006: solo necesitamos saber a qué mesa pertenece
// la reserva y su rango de tiempo para detectar solapamientos.
@Entity('reservations')
@Index(['table', 'startAt', 'endAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Table, { nullable: false, onDelete: 'CASCADE' })
  table: Table;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;
}
