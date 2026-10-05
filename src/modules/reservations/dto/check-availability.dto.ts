import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

// DTO para el endpoint GET /api/v1/reservations/availability
// Todos los campos llegan como query params (string), por eso usamos
// @Type(() => Number) para que class-transformer los convierta antes de validar.
export class CheckAvailabilityDto {
  // Fecha obligatoria en formato ISO 8601 (YYYY-MM-DD)  → RN-037
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  date: string;

  // Hora obligatoria en formato HH:MM (24 h)  → RN-037
  @IsNotEmpty({ message: 'La hora es obligatoria' })
  @IsString({ message: 'La hora debe ser una cadena HH:MM' })
  time: string;

  // Cantidad de personas obligatoria y mayor que cero → RN-036
  @IsNotEmpty({ message: 'La cantidad de personas es obligatoria' })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad de personas debe ser un número entero' })
  @Min(1, { message: 'La cantidad de personas debe ser mayor que cero' })
  guests: number;
}
