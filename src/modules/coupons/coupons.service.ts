import { Injectable, Logger } from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { CouponType } from '@prisma/client';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: CouponType;
    value: number;
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

    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = dto.subtotal * (coupon.value.toNumber() / 100);
    } else {
      discountAmount = coupon.value.toNumber();
    }

    // Discount cannot exceed subtotal
    if (discountAmount > dto.subtotal) {
      discountAmount = dto.subtotal;
    }

    this.logger.log(`Coupon ${coupon.code} validated — discount: R$ ${discountAmount.toFixed(2)}`);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value.toNumber(),
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
}
