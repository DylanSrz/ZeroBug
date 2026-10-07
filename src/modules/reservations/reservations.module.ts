import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service.js';
import { ReservationsController } from './reservations.controller.js';
import { Reservation } from './entities/reservation.entity.js';
import { Table } from '../tables/entities/table.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Table])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}