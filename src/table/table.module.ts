import { Module } from '@nestjs/common';
import { TableService } from './table.service.js';
import { TableController } from './table.controller.js';

@Module({
  controllers: [TableController],
  providers: [TableService],
})
export class TableModule {}
