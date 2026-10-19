import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity.js';

// En #82 se agregan el EmployeesService y en #83 el controller
@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  exports: [TypeOrmModule],
})
export class EmployeesModule {}
