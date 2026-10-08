import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IsNotPastReservation,
  RESERVATION_DATE_PATTERN,
  RESERVATION_TIME_PATTERN,
} from '../validators/index.js';

const PHONE_PATTER = /^(?=(?:\D*\d){7,15}\D*$)\+?[\d\s().-]+$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReservationDto {
  @ApiProperty({ example: 'Dilant Murillo', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  @ApiProperty({
    example: '3001234567',
    description:
      'Teléfono de contacto: 7 a 15 dígitos (admite +, espacios, guiones y paréntesis como separadores)',
  })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTER, {
    message: 'phone debe tener entre 7 y 15 digitos',
  })
  phone: string;

  @ApiProperty({ example: 'dilant@example.com' })
  @Transform(trim)
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '2026-12-20',
    description:
      'Fecha de la reserva (YYYY-MM-DD). No puede estar en el pasado',
  })
  @Matches(RESERVATION_DATE_PATTERN, {
    message: 'date debe tener el formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'date debe ser una fecha real' })
  @IsNotPastReservation()
  date: string;

  @ApiProperty({
    example: '19:00',
    description: 'Hora de la reserva en formato 24 horas',
  })
  @Matches(RESERVATION_TIME_PATTERN, {
    message: 'time debe tener el formato 24 horas',
  })
  time: string;

  @ApiProperty({
    example: 4,
    minimum: 1,
    description: 'Número de personas, mayor a cero',
  })
  @IsInt()
  @IsPositive()
  guests: number;
}
