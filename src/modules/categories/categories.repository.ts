import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        products: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    return category;
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async update(id: string, data: UpdateCategoryDto) {
    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    if (category._count.products > 0 || category._count.children > 0) {
      throw new Error(
        'Cannot delete category with products or subcategories',
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async findRootCategories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
