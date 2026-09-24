import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity.js';
import { TablesService } from './tables.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Table])],
  providers: [TablesService],
  exports: [TypeOrmModule, TablesService],
})
export class TablesModule {}
