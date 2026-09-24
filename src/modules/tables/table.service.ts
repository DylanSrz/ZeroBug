// src/modules/tables/table.service.ts

// Este archivo es el "cerebro" de las mesas: aquí viven las reglas de negocio.
// Los DTOs solo validan que los datos tengan la forma correcta;
// aquí decidimos qué hacer con esos datos (crear, buscar, actualizar, rechazar).

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Estas dos excepciones son propias del proyecto (no vienen de NestJS
// directamente), y ya las usa categories.service.ts. Las usamos aquí
// también para que TODOS los módulos devuelvan errores con el mismo
// formato (statusCode, error, message, y en el caso de reglas de
// negocio, también un campo "rule" con el código de la regla, ej. RN-016).
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../common/exceptions/index.js';
import { Table } from './entities/table.entity.js';
import { TableStatus } from './enums/index.js';
import { CreateTableDto } from './dto/create-table.dto.js';
import { UpdateTableDto } from './dto/update-table.dto.js';
import { UpdateTableStatusDto } from './dto/update-table-status.dto.js';
import { FilterTablesDto } from './dto/filter-tables.dto.js';

@Injectable()
export class TableService {
  constructor(
    // @InjectRepository le pide a NestJS/TypeORM: "dame el repositorio
    // que sabe hablar con la tabla 'tables' de Postgres". El Repository
    // es el objeto que realmente hace las consultas SQL (find, save, etc.)
    @InjectRepository(Table)
    private readonly tables: Repository<Table>,
  ) {}

  /** RN-016, RN-018: número único y estado inicial AVAILABLE por defecto. */
  async create(dto: CreateTableDto): Promise<Table> {
    // Antes de guardar, revisamos que no exista ya una mesa con ese número.
    // Si existe, esta función lanza el error y create() se detiene aquí.
    await this.assertNumberAvailable(dto.number);

    // tables.create() NO guarda nada todavía, solo arma
    // un objeto Table en memoria con los datos del DTO
    const table = this.tables.create({
      ...dto,
      status: TableStatus.AVAILABLE, // RN-018: toda mesa nueva inicia AVAILABLE
    });

    // save() sí escribe el registro en la base de datos y devuelve
    // la mesa ya guardada (con su id generado, createdAt, etc.)
    return this.tables.save(table);
  }

  /** Lista mesas aplicando filtros opcionales por status, zone y capacity mínima. */
  async findAll(filters: FilterTablesDto): Promise<Table[]> {
    // createQueryBuilder arma la consulta SQL "a mano", pieza por pieza,
    // en vez de usar un find() simple. Es útil cuando los filtros son opcionales.
    const query = this.tables
      .createQueryBuilder('table')
      .orderBy('table.number', 'ASC'); // siempre ordenado por número de mesa

    // Cada "if" agrega una condición SOLO si el filtro fue enviado.
    // Así, si no mandan ningún filtro, la consulta trae todas las mesas.
    if (filters.status) {
      query.andWhere('table.status = :status', { status: filters.status });
    }

    if (filters.zone) {
      query.andWhere('table.zone = :zone', { zone: filters.zone });
    }

    if (filters.capacity) {
      // >= porque el filtro es "capacidad mínima", no capacidad exacta
      query.andWhere('table.capacity >= :capacity', {
        capacity: filters.capacity,
      });
    }

    // getMany() ejecuta finalmente la consulta armada y trae los resultados
    return query.getMany();
  }

  // Busca una mesa por su id. Si no existe, corta el flujo con un 404.
  async findOne(id: string): Promise<Table> {
    // findOneBy es una forma corta de escribir findOne({ where: { id } }).
    // Hace exactamente lo mismo, pero con menos código.
    const table = await this.tables.findOneBy({ id });

    if (!table) {
      // EntityNotFoundException es la excepción propia del proyecto:
      // recibe el NOMBRE de la entidad ("Mesa") y el id que se buscó,
      // y arma automáticamente un error 404 con un mensaje consistente
      // en todos los módulos: "Mesa con id X no existe"
      throw new EntityNotFoundException('Mesa', id);
    }

    return table;
  }

  /** RN-016: revalida unicidad del número si se modifica. */
  async update(id: string, dto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id); // si no existe, ya lanza 404 aquí

    // Solo si el DTO trae un 'number' distinto al actual, revisamos
    // de nuevo que no choque con otra mesa. Si no cambia el número,
    // no hace falta revalidar nada. Le pasamos el id de la mesa actual
    // para que, si encuentra "otra mesa" con ese número, sea REALMENTE
    // otra y no la misma mesa que estamos editando.
    if (dto.number !== undefined && dto.number !== table.number) {
      await this.assertNumberAvailable(dto.number, id);
    }

    // merge() es el método de TypeORM para copiar sobre 'table' solo
    // los campos que vengan en el dto, dejando intactos los que no se
    // enviaron. Hace lo mismo que Object.assign, pero es el método
    // "oficial" de TypeORM y el que ya usa el resto del proyecto.
    this.tables.merge(table, dto);

    return this.tables.save(table);
  }

  /**
   * RN-020: cambiar estado entre los definidos por el sistema.
   * RN-019 (OUT_OF_SERVICE no reservable/no pedidos) se valida en
   * HU-006/HU-020, no aquí — este método solo persiste el cambio de estado.
   */
  async updateStatus(id: string, dto: UpdateTableStatusDto): Promise<Table> {
    const table = await this.findOne(id); // 404 si no existe

    // RN-020 (solo estados válidos) ya quedó garantizada antes de llegar
    // aquí, por el @IsEnum() del DTO — si el status fuera inválido,
    // Nest ya habría respondido 400 antes de entrar a este método.
    table.status = dto.status;

    return this.tables.save(table);
  }

  /** RN-016: el número de mesa debe ser único en el sistema. */
  private async assertNumberAvailable(
    number: number,
    // excludeId es opcional: solo se usa en update(), para permitir que
    // una mesa "choque consigo misma" sin que eso cuente como duplicado
    // (ej. actualizar una mesa sin cambiar realmente su número)
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.tables.findOneBy({ number });

    // Si existe una mesa con ese número Y no es la misma mesa que estamos
    // editando (existing.id !== excludeId), entonces sí es un duplicado real
    if (existing && existing.id !== excludeId) {
      // BusinessRuleException es la excepción propia del proyecto para
      // errores de reglas de negocio: recibe el mensaje y el código de
      // la regla (RN-016), y arma un error 409 que incluye ese código
      // en la respuesta, igual que lo hace categories con RN-021.
      throw new BusinessRuleException(
        `Ya existe una mesa con el número ${number}`,
        'RN-016',
      );
    }
  }
}