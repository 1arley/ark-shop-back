import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        minPurchase: data.minPurchase,
        maxUses: data.maxUses,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    return coupon;
  }

  async findByCode(code: string) {
    return this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [coupons, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count(),
    ]);

    return {
      data: coupons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, data: UpdateCouponDto) {
    await this.findById(id);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.minPurchase !== undefined && { minPurchase: data.minPurchase }),
        ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
        ...(data.validFrom !== undefined && {
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
        }),
        ...(data.validTo !== undefined && {
          validTo: data.validTo ? new Date(data.validTo) : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.coupon.delete({
      where: { id },
    });
  }

  /**
   * Validate coupon for use: check active, dates, max uses, min purchase.
   * Returns the coupon if valid, throws BadRequestException otherwise.
   */
  async validateForUse(code: string, subtotal: number) {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is no longer active');
    }

    const now = new Date();

    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    if (coupon.validTo && coupon.validTo < now) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon has reached maximum uses');
    }

    if (coupon.minPurchase !== null && subtotal < coupon.minPurchase.toNumber()) {
      throw new BadRequestException(
        `Minimum purchase of R$ ${coupon.minPurchase.toNumber().toFixed(2)} required`,
      );
    }

    return coupon;
  }

  /**
   * Increment usedCount atomically.
   */
  async incrementUsage(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }
}
