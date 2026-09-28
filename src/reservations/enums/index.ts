// "Barrel file": un solo punto de entrada para importar los enums de esta
// carpeta. Así en otros archivos escribimos import { ReservationStatus }
// from '../enums/index.js' sin recordar el nombre exacto de cada archivo.
export { ReservationStatus } from './reservation-status.enum.js';
