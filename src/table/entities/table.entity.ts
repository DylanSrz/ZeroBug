import { Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('table')
export class Table {
    @PrimaryGeneratedColumn('uuid')
    id: string
}
