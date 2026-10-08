// Estados por los que pasa una reserva. Las transiciones válidas entre
// ellos se definen en HU-007 (#57); este enum es la única definición.
export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  COMPLETED = 'COMPLETED',
}
