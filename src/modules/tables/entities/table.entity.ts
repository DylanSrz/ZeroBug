import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { int, number } from "zod";
import { IsInt, Min} from "class-validator";

export enum tableZone {
    INTERIOR= "interior",
    TERRACE= "terrace",
    BAR= "bar",
    VIP= "vip"
}

export enum tableStatus {
    AVAILABLE= "available",
    OCCUPIED = "occupied",
    OUT_OF_SERVICES= "out_of_services"
}

@Entity()
export class Table {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type:'int', unique:true })
    number: string;
    
    @Column({type:'int'})
    capacity: number;
    
    @Column({
        type:'enum',
        enum: tableZone,
        default: tableZone.INTERIOR,
    })
    zone: string;

    @Column({
        type: "enum",
        enum: tableStatus,
        default: tableStatus.AVAILABLE,
    })
    status: string;
    
    @CreateDateColumn()
    createdAt: Date;
    
    @UpdateDateColumn()
    updatdeAt: Date;
}