import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KeyStatus, Prisma } from '@prisma/client';
import type { ProductType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { toNumber } from '@/common/decimal';
import { MAX_PAGE_SIZE } from '@/common/constants';

const PRODUCT_TYPE_ACCOUNT = 'ACCOUNT' as ProductType;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async validateActivationInventory(
    productId: string | null,
    productType: ProductType,
    shouldBeActive: boolean,
  ) {
    if (!shouldBeActive) {
      return;
    }

    const whereBase = productId ? { productId } : undefined;
    const availableKeys = await this.prisma.key.count({
      where: {
        ...(whereBase ?? {}),
        status: KeyStatus.AVAILABLE,
      },
    });
    const availableAccounts = await this.prisma.account.count({
      where: {
        ...(whereBase ?? {}),
        status: KeyStatus.AVAILABLE,
      },
    });

    if (productType === PRODUCT_TYPE_ACCOUNT && availableAccounts <= 0) {
      throw new BadRequestException(
        'Cannot activate ACCOUNT product without available stock. ' +
          'Import at least one available account first.',
      );
    }

    if (productType !== PRODUCT_TYPE_ACCOUNT && availableKeys <= 0) {
      throw new BadRequestException(
        'Cannot activate KEY product without available stock. ' +
          'Import at least one available key first.',
      );
    }
  }

  async create(data: CreateProductDto) {
    const productType = data.productType ?? 'KEY';
    const shouldBeActive = data.isActive ?? false;

    await this.validateActivationInventory(null, productType, shouldBeActive);

    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock ?? 0,
        isActive: shouldBeActive,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
        productType,
        instructions: data.instructions,
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

    const cappedLimit = Math.min(limit, MAX_PAGE_SIZE);
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: cappedLimit,
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
    const existingProduct = await this.findById(id);

    const [totalKeys, availableKeys, totalAccounts, availableAccounts] = await Promise.all([
      this.prisma.key.count({ where: { productId: id } }),
      this.prisma.key.count({ where: { productId: id, status: KeyStatus.AVAILABLE } }),
      this.prisma.account.count({ where: { productId: id } }),
      this.prisma.account.count({ where: { productId: id, status: KeyStatus.AVAILABLE } }),
    ]);

    const hasDigitalItems = totalKeys > 0 || totalAccounts > 0;
    const productType = data.productType ?? existingProduct.productType;
    const shouldBeActive = data.isActive ?? existingProduct.isActive;
    const derivedStock =
      productType === PRODUCT_TYPE_ACCOUNT || (totalAccounts > 0 && totalKeys === 0)
        ? availableAccounts
        : availableKeys;

    await this.validateActivationInventory(id, productType, shouldBeActive);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: hasDigitalItems ? derivedStock : data.stock,
        isActive: shouldBeActive,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
        productType: data.productType,
        instructions: data.instructions,
      },
    });

    return { ...product, price: toNumber(product.price) };
  }

  delete(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  async findByCategory(categoryId: string, page: number = 1, limit: number = 10) {
    const cappedLimit = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * cappedLimit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: cappedLimit,
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

  findByName(name: string) {
    return this.prisma.product.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
  }

  createMany(
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
