import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async create(createProductDto: CreateProductDto) {
    return this.productsRepository.create(createProductDto);
  }

  async findAll(
    page: number,
    limit: number,
    filters?: {
      isActive?: boolean;
      categoryId?: string;
      search?: string;
    },
  ) {
    return this.productsRepository.findAll(page, limit, filters);
  }

  async findOne(id: string) {
    return this.productsRepository.findById(id);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    return this.productsRepository.update(id, updateProductDto);
  }

  async delete(id: string) {
    return this.productsRepository.delete(id);
  }

  async findByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.productsRepository.findByCategory(categoryId, page, limit);
  }
}
