import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async create(createCategoryDto: CreateCategoryDto) {
    return this.categoriesRepository.create(createCategoryDto);
  }

  async findById(id: string) {
    return this.categoriesRepository.findById(id);
  }

  async findAll() {
    return this.categoriesRepository.findAll();
  }

  async findRootCategories() {
    return this.categoriesRepository.findRootCategories();
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesRepository.update(id, updateCategoryDto);
  }

  async delete(id: string) {
    return this.categoriesRepository.delete(id);
  }
}
