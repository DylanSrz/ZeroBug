import { PartialType } from '@nestjs/swagger';
import { CreateTableDto } from './create-table.dto.js';

export class UpdateTableDto extends PartialType(CreateTableDto) {}
