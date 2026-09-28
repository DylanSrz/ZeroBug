// El módulo es el "empaquetador": le dice a NestJS qué piezas pertenecen
// juntas. Por ahora solo registra las entidades; el service y el controller
// se agregarán en las siguientes sub-tareas.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity.js';
// OJO con la ruta: `tables` es carpeta HERMANA de `reservations`, por eso
// se sube un nivel con `../` y se entra a `tables/`.
import { Table } from '../modules/tables/entities/table.entity.js';

@Module({
  // forFeature registra las entidades con las que este módulo puede hablar
  // a la base de datos. Incluimos Table además de Reservation porque la
  // consulta de disponibilidad (siguiente sub-tarea) necesita leer mesas
  // directamente (RN-038, RN-039, RN-041).
  imports: [TypeOrmModule.forFeature([Reservation, Table])],
  // exports permite que otros módulos reutilicen estos repositorios.
  exports: [TypeOrmModule],
})
export class ReservationsModule {}
