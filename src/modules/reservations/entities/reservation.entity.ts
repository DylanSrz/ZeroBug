import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Table } from '../../tables/entities/table.entity.js';
import { ReservationStatus } from '../enums/index.js';

// Una reserva de mesa hecha por un cliente. La mesa se asigna al registrarla
// (HU-007) y queda en null si se libera. El conflicto horario entre reservas
// de la misma mesa se define en docs/decisiones.md (D-001).
@Entity('reservations')
// Índice para las consultas de conflicto: "reservas de esta mesa en este día"
@Index('IDX_reservations_table_date', ['tableId', 'date'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  customerName: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Fecha y hora de inicio por separado ('2026-10-09' y '20:00:00'),
  // tal como las envía el cliente
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  @Column({ type: 'int' })
  guests: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  // Columna física de la FK, explícita para usarla en el índice y en los where
  @Column({ type: 'uuid', nullable: true })
  tableId: string | null;

  @ManyToOne(() => Table, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tableId' })
  table: Table | null;

  // Momento de cada transición de estado (HU-010 a HU-013)
  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  noShowAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
