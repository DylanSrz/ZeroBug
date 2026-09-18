import { Module } from '@nestjs/common';
import { TableService } from './table.service.js';
import { TableController } from './table.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Table])
  ],
  controllers: [TableController],
  providers: [TableService],
  exports: [TypeOrmModule]
})
export class TableModule { }
