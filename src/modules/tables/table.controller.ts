// Este archivo es la "puerta de entrada" HTTP de las mesas: aquí es
// donde llegan las peticiones (POST, GET, PATCH) y se las pasamos
// al service, que es quien realmente sabe qué hacer con ellas.

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { TableService } from './table.service.js';
import { Table } from './entities/table.entity.js';
import { CreateTableDto } from './dto/create-table.dto.js';
import { UpdateTableDto } from './dto/update-table.dto.js';
import { UpdateTableStatusDto } from './dto/update-table-status.dto.js';
import { FilterTablesDto } from './dto/filter-tables.dto.js';

// @ApiTags agrupa todos los endpoints de este controller bajo
// una sola sección llamada "Tables" en la documentación de Swagger
@ApiTags('Table')
@Controller('v1/table')
export class TableController {
  // Nest "inyecta" el service automáticamente: nosotros solo lo pedimos
  // en el constructor y Nest se encarga de dárnoslo ya armado
  constructor(private readonly tableService: TableService) {}

  // POST /api/v1/tables
  @Post()
  // @HttpCode fuerza el código de respuesta exitosa a 201 (creado),
  // en vez del 200 que Nest pondría por defecto en un POST
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva mesa' })
  @ApiResponse({ status: 201, description: 'Mesa creada correctamente', type: Table })
  @ApiResponse({ status: 400, description: 'Datos inválidos (número/capacidad/zona)' })
  @ApiResponse({ status: 409, description: 'Ya existe una mesa con ese número' })
  create(@Body() dto: CreateTableDto): Promise<Table> {
    // @Body() toma el JSON que mandaron en la petición y lo convierte
    // automáticamente en un CreateTableDto ya validado
    return this.tableService.create(dto);
  }

  // GET v1/tables?status=&zone=&capacity=
  @Get()
  @ApiOperation({ summary: 'Listar mesas con filtros opcionales' })
  @ApiResponse({ status: 200, description: 'Listado de mesas', type: [Table] })
  findAll(@Query() filters: FilterTablesDto): Promise<Table[]> {
    // @Query() toma lo que viene después del "?" en la URL
    // (?status=AVAILABLE&zone=BAR&capacity=4) y lo convierte
    // en un FilterTablesDto, con los strings ya transformados a número/enum
    return this.tableService.findAll(filters);
  }

  // GET v1/table/{id}
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una mesa específica' })
  @ApiParam({ name: 'id', description: 'UUID de la mesa' })
  @ApiResponse({ status: 200, description: 'Mesa encontrada', type: Table })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada' })
  findOne(@Param('id') id: string): Promise<Table> {
    // @Param('id') toma el pedazo de la URL marcado como :id
    // (por ejemplo, en /tables/uuid-123, id sería "uuid-123")
    return this.tableService.findOne(id);
  }

  // PATCH v1/tables/{id}
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los datos de una mesa' })
  @ApiParam({ name: 'id', description: 'UUID de la mesa' })
  @ApiResponse({ status: 200, description: 'Mesa actualizada', type: Table })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada' })
  @ApiResponse({ status: 409, description: 'El nuevo número ya está en uso' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ): Promise<Table> {
    return this.tableService.update(id, dto);
  }

  // PATCH v1/table/{id}/status
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar el estado de una mesa' })
  @ApiParam({ name: 'id', description: 'UUID de la mesa' })
  @ApiResponse({ status: 200, description: 'Estado actualizado', type: Table })
  @ApiResponse({ status: 400, description: 'Estado inválido' })
  @ApiResponse({ status: 404, description: 'Mesa no encontrada' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ): Promise<Table> {
    return this.tableService.updateStatus(id, dto);
  }
}