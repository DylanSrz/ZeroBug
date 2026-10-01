import { Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ReservationStatus } from "../enums/reservation-status.enum.js";
import { table } from "console";

@Entity('reservations')
@Index(['table', 'startAt', 'endAt'])   
export class Reservation {
    @PrimaryGeneratedColumn('uuid')
    id:String


  

    
}
