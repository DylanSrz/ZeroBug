import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { Employee } from './entities/employee.entity.js';
import { EmployeesService } from './employees.service.js';

// En #83 se agrega el controller
@Module({
  imports: [TypeOrmModule.forFeature([Employee]), UsersModule],
  providers: [EmployeesService],
  exports: [TypeOrmModule, EmployeesService],
})
export class EmployeesModule {}
