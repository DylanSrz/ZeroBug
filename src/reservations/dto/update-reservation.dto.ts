import { PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto.js';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}
