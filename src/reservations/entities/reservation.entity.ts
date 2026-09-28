// Esta entidad es el "plano" de la tabla `reservations` en Postgres:
// cada propiedad de la clase se convierte en una columna. TypeORM lee este
// archivo para generar la migración que crea la tabla real.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Table } from '../../modules/tables/entities/table.entity.js';
import { ReservationStatus } from '../enums/index.js';

// @Entity('reservations'): nombre explícito de la tabla en Postgres.
@Entity('reservations')
// @Index(['table', 'date']): crea un índice combinado sobre (tableId, date).
// Un índice es como el índice de un libro: hace que buscar "las reservas de
// ESTA mesa en ESTA fecha" sea muy rápido. HU-006 hace justo esa búsqueda
// para detectar conflictos de horario (RN-040).
@Index(['table', 'date'])
export class Reservation {
  // Clave primaria autogenerada como UUID (convención del equipo).
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Datos de contacto de quien reserva (por ahora texto simple; en Sprint 3
  // se agregará `customer` como relación a la tabla de usuarios).
  @Column({ type: 'varchar' })
  customerName: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar' })
  email: string;

  // Tipo DATE de Postgres: guarda solo año-mes-día (ej. "2026-09-20"),
  // sin hora. Lo tipamos como string porque así lo devuelve el driver.
  @Column({ type: 'date' })
  date: string;

  // Tipo TIME de Postgres: guarda solo la hora (ej. "19:00:00"), sin fecha.
  @Column({ type: 'time' })
  time: string;

  // Cantidad de personas. La regla "mayor que cero" (RN-036) se valida en
  // el DTO, no aquí: la entidad solo describe la tabla.
  @Column({ type: 'int' })
  guests: number;

  // Estado de la reserva, tipado con el enum. Toda reserva nueva nace en
  // PENDING sin que el código tenga que asignarlo.
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  // Relación ManyToOne: MUCHAS reservas pueden apuntar a UNA misma mesa.
  // - nullable: true → una reserva puede existir sin mesa asignada aún.
  // - onDelete: 'SET NULL' → si algún día se borra la mesa, las reservas
  //   no se borran: solo quedan sin mesa asignada.
  // - @JoinColumn({ name: 'tableId' }) → nombre de la columna FK (llave
  //   foránea) que apunta a tables.id.
  @ManyToOne(() => Table, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tableId' })
  table: Table | null;

  // Sellos de tiempo de auditoría: cada uno se llena SOLO cuando la reserva
  // llega a ese estado. Al crearla todos son null (por eso nullable: true).
  // 'timestamptz' = fecha y hora con zona horaria.
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

  // Timestamps automáticos: TypeORM los llena solo al crear/actualizar.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
