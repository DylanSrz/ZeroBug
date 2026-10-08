// Reglas de fecha y hora de una reserva. Viven aparte del DTO para que
// cualquier otro DTO (por ejemplo el de consultar disponibilidad) las reutilice.

import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

// Fecha con formato YYYY-MM-DD (por ejemplo 2026-12-20).
export const RESERVATION_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Hora en formato 24 h, HH:mm (por ejemplo 19:00). Horas 00-23, minutos 00-59.
export const RESERVATION_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Dice si la fecha (y la hora, si es válida) ya pasó respecto a "ahora".
// Recibe "now" como parámetro opcional para poder probarla sin depender del reloj.
export function isPastReservation(
  date: string,
  time?: string,
  now: Date = new Date(),
): boolean {
  const dateMatch = RESERVATION_DATE_PATTERN.exec(date);
  if (!dateMatch) {
    return false; // formato inválido: lo reporta otro validador, no este
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const timeMatch =
    time === undefined ? null : RESERVATION_TIME_PATTERN.exec(time);

  if (!timeMatch) {
    // Sin una hora válida solo se puede comparar el día:
    // es pasado si es anterior a hoy a las 00:00.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(year, month - 1, day).getTime() < today.getTime();
  }

  // Con fecha y hora se compara el momento exacto de la reserva con "ahora".
  const slot = new Date(
    year,
    month - 1,
    day,
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  return slot.getTime() < now.getTime();
}

// Decorador para usar en el campo "date" del DTO:  @IsNotPastReservation()
// Mira el campo "date" (el valor decorado) y el campo "time" del mismo objeto.
export function IsNotPastReservation(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isNotPastReservation',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return true; // si no es texto, ya lo rechazan los otros validadores
          }
          const { time } = args.object as { time?: unknown };
          return !isPastReservation(
            value,
            typeof time === 'string' ? time : undefined,
          );
        },
        defaultMessage(): string {
          return 'la reserva no puede ser para una fecha u hora pasada (RN-042)';
        },
      },
    });
  };
}
