import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { toNumber } from '@/common/decimal';

@Injectable()
export class CouponsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCouponDto) {
    const coupon = await this.prisma.coupon.create({
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

    return {
      ...coupon,
      value: toNumber(coupon.value),
      minPurchase: toNumber(coupon.minPurchase),
    };
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    return {
      ...coupon,
      value: toNumber(coupon.value),
      minPurchase: toNumber(coupon.minPurchase),
    };
  }

  async findByCode(code: string) {
    return await this.prisma.coupon.findUnique({
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
      data: coupons.map(c => ({
        ...c,
        value: toNumber(c.value),
        minPurchase: toNumber(c.minPurchase),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, data: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.update({
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

    return {
      ...coupon,
      value: toNumber(coupon.value),
      minPurchase: toNumber(coupon.minPurchase),
    };
  }

  async delete(id: string) {
    return await this.prisma.coupon.delete({
      where: { id },
    });
  }

  /**
   * Validate coupon for use: check active, dates, max uses, min purchase.
   * Returns the coupon if valid, throws BadRequestException otherwise.
   * Uses generic error messages to prevent coupon enumeration.
   */
  async validateForUse(code: string, subtotal: number) {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    const now = new Date();

    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    if (coupon.validTo && coupon.validTo < now) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    if (coupon.minPurchase !== null && subtotal < toNumber(coupon.minPurchase)!) {
      throw new BadRequestException(
        `Minimum purchase of R$ ${toNumber(coupon.minPurchase)!.toFixed(2)} required`,
      );
    }

    return coupon;
  }

  /**
   * Atomically increment usedCount only if maxUses has not been reached.
   * Returns true if the increment succeeded, false if maxUses was exceeded.
   * This prevents TOCTOU race conditions on concurrent coupon usage.
   */
  async incrementUsageIfAvailable(id: string, maxUses: number | null): Promise<boolean> {
    if (maxUses === null) {
      // Unlimited uses — just increment
      await this.prisma.coupon.update({
        where: { id },
        data: { usedCount: { increment: 1 } },
      });
      return true;
    }

    // Atomic conditional increment: only succeeds if usedCount < maxUses
    const result = await this.prisma.coupon.updateMany({
      where: { id, usedCount: { lt: maxUses } },
      data: { usedCount: { increment: 1 } },
    });

    return result.count > 0;
  }

  /**
   * Increment usedCount atomically (legacy — prefer incrementUsageIfAvailable).
   */
  async incrementUsage(id: string) {
    return await this.prisma.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }
}
