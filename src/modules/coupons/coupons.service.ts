import { Injectable, Logger } from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { toNumber } from '@/common/decimal';
import type { Prisma } from '@prisma/client';

// Coupon type as string literal to avoid Prisma client dependency issues
type CouponType = 'PERCENTAGE' | 'FIXED';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: CouponType;
    value: number;
    maxUses: number | null;
  };
  discountAmount: number;
  message: string;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly couponsRepository: CouponsRepository) {}

  async create(createCouponDto: CreateCouponDto) {
    this.logger.log(`Creating coupon: ${createCouponDto.code}`);
    return this.couponsRepository.create(createCouponDto);
  }

  async findById(id: string) {
    return this.couponsRepository.findById(id);
  }

  async findByCode(code: string) {
    return this.couponsRepository.findByCode(code);
  }

  async findAll(page: number, limit: number) {
    return this.couponsRepository.findAll(page, limit);
  }

  async update(id: string, updateCouponDto: UpdateCouponDto) {
    this.logger.log(`Updating coupon: ${id}`);
    return this.couponsRepository.update(id, updateCouponDto);
  }

  async delete(id: string) {
    this.logger.log(`Deleting coupon: ${id}`);
    return this.couponsRepository.delete(id);
  }

  /**
   * Validate a coupon and calculate discount amount.
   * Returns discount info without incrementing usage count.
   */
  async validateAndCalculate(dto: ApplyCouponDto): Promise<CouponValidationResult> {
    const coupon = await this.couponsRepository.validateForUse(dto.code, dto.subtotal);

    let discountAmount: number;

    if (coupon.type === 'PERCENTAGE') {
      discountAmount = dto.subtotal * (toNumber(coupon.value)! / 100);
    } else {
      discountAmount = toNumber(coupon.value)!;
    }

    // Discount cannot exceed subtotal
    if (discountAmount > dto.subtotal) {
      this.logger.warn(
        `Coupon ${coupon.code} discount R$ ${discountAmount.toFixed(2)} exceeds subtotal R$ ${dto.subtotal.toFixed(2)}, capping`,
      );
      discountAmount = dto.subtotal;
    }

    this.logger.log(`Coupon ${coupon.code} validated — discount: R$ ${discountAmount.toFixed(2)}`);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: toNumber(coupon.value)!,
        maxUses: coupon.maxUses,
      },
      discountAmount,
      message: `Discount of R$ ${discountAmount.toFixed(2)} applied`,
    };
  }

  /**
   * Mark coupon as used (increment usage count).
   * Should be called AFTER order is successfully created.
   */
  async markAsUsed(couponId: string) {
    this.logger.log(`Marking coupon ${couponId} as used`);
    return this.couponsRepository.incrementUsage(couponId);
  }

  /**
   * Atomically increment coupon usage count only if maxUses has not been reached.
   * Returns true if the increment succeeded, false if maxUses was exceeded.
   * Use this inside the order creation transaction to prevent race conditions.
   */
  async markAsUsedIfAvailable(couponId: string, maxUses: number | null): Promise<boolean> {
    this.logger.log(`Attempting to mark coupon ${couponId} as used (maxUses: ${maxUses})`);
    return this.couponsRepository.incrementUsageIfAvailable(couponId, maxUses);
  }

  async markAsUsedIfAvailableTx(
    tx: Prisma.TransactionClient,
    couponId: string,
    maxUses: number | null,
  ): Promise<boolean> {
    this.logger.log(
      `Attempting to mark coupon ${couponId} as used in transaction (maxUses: ${maxUses})`,
    );
    return this.couponsRepository.incrementUsageIfAvailableTx(tx, couponId, maxUses);
  }
}
