// Enum = una lista cerrada de valores permitidos. Una reserva solo puede
// estar en UNO de estos 6 estados; cualquier otro valor se rechaza, tanto
// en el código como en la base de datos (Postgres crea un tipo ENUM real).
export enum ReservationStatus {
  PENDING = 'PENDING', // reserva creada, todavía sin confirmar (estado inicial)
  CONFIRMED = 'CONFIRMED', // el restaurante/cliente la confirmó
  CHECKED_IN = 'CHECKED_IN', // el cliente llegó y se registró en el local
  CANCELLED = 'CANCELLED', // se canceló antes de la fecha
  NO_SHOW = 'NO_SHOW', // el cliente nunca se presentó
  COMPLETED = 'COMPLETED', // la reserva se cumplió y terminó normalmente
}
