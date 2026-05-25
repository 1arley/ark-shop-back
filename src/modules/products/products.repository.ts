import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { toNumber } from '@/common/decimal';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock ?? 0,
        isActive: data.isActive ?? true,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
      },
    });

    return { ...product, price: toNumber(product.price) };
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        _count: {
          select: { keys: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return {
      ...product,
      price: toNumber(product.price),
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      isActive?: boolean;
      categoryId?: string;
      search?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const { isActive, categoryId, search } = filters || {};

    const where: Prisma.ProductWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where,
        include: {
          category: true,
        },
        orderBy: [
          // First sort by stock availability (in stock first)
          { stock: 'desc' },
          // Then by creation date
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map(p => ({ ...p, price: toNumber(p.price) })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, data: UpdateProductDto) {
    // Verifica se o produto existe antes de atualizar
    await this.findById(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        isActive: data.isActive,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
      },
    });

    return { ...product, price: toNumber(product.price) };
  }

  async delete(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async findByCategory(categoryId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where: { categoryId },
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({
        where: { categoryId },
      }),
    ]);

    return {
      data: products.map(p => ({ ...p, price: toNumber(p.price) })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByName(name: string) {
    return this.prisma.product.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
  }

  async createMany(
    products: Array<{
      name: string;
      description?: string | null;
      price: number;
      stock?: number;
      isActive?: boolean;
      categoryId?: string | null;
      imageUrl?: string | null;
    }>,
  ) {
    return this.prisma.product.createMany({
      data: products.map(p => ({
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock ?? 0,
        isActive: p.isActive ?? true,
        categoryId: p.categoryId,
        imageUrl: p.imageUrl,
      })),
    });
  }
}
