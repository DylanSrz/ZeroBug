import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../common/exceptions/index.js';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
} from './dto/index.js';
import { Category } from './entities/category.entity.js';
import { CategoryStatus } from './enums/index.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /** RN-021, RN-022: nombre único y estado inicial ACTIVE por defecto. */
  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameAvailable(dto.name);

    const category = this.categories.create({
      ...dto,
      status: CategoryStatus.ACTIVE,
    });
    return this.categories.save(category);
  }
