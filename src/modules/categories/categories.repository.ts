import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { toNumber } from '@/common/decimal';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCategoryDto) {
    return await this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
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

    if (!category) return null;

    return {
      ...category,
      products: category.products.map(p => ({
        ...p,
        price: toNumber(p.price),
      })),
    };
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({
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

    return categories;
  }

  async update(id: string, data: UpdateCategoryDto) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          parentId: data.parentId,
        },
        include: {
          parent: true,
          children: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2025' || error?.message?.includes('Record to update not found')) {
        throw new NotFoundException('Category not found');
      }
      throw error;
    }
  }

  async delete(id: string, force: boolean = false) {
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
      throw new NotFoundException('Category not found');
    }

    // Se for force=true, deleta mesmo com produtos/subcategorias (eles serão tratados pelo cascade)
    if (!force && (category._count.products > 0 || category._count.children > 0)) {
      // Verifica mais detalhadamente para dar uma mensagem melhor
      const productsCount = await this.prisma.product.count({
        where: { categoryId: id },
      });
      const childrenCount = await this.prisma.category.count({
        where: { parentId: id },
      });

      if (productsCount > 0 || childrenCount > 0) {
        const message = [];
        if (productsCount > 0) {
          message.push(`${productsCount} product${productsCount > 1 ? 's' : ''}`);
        }
        if (childrenCount > 0) {
          message.push(`${childrenCount} subcategor${childrenCount > 1 ? 'ies' : 'y'}`);
        }
        throw new BadRequestException(
          `Cannot delete category: it has ${message.join(' and ')}. Use force=true to delete anyway.`,
        );
      }
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async findRootCategories() {
    return await this.prisma.category.findMany({
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
