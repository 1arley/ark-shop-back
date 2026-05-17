import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from '../coupons.service';
import { CouponsRepository } from '../coupons.repository';
import { CouponType } from '@prisma/client';
import { CreateCouponDto } from '../dto/create-coupon.dto';

describe('CouponsService', () => {
  let service: CouponsService;
  let repository: CouponsRepository;

  const mockCoupon = {
    id: 'coupon-id-1',
    code: 'PROMO10',
    type: CouponType.PERCENTAGE,
    value: { toNumber: () => 10 } as any,
    minPurchase: { toNumber: () => 50 } as any,
    maxUses: 100,
    usedCount: 5,
    validFrom: new Date('2025-01-01'),
    validTo: new Date('2030-12-31'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    validateForUse: jest.fn(),
    incrementUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CouponsService, { provide: CouponsRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    repository = module.get<CouponsRepository>(CouponsRepository);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a coupon', async () => {
      const dto: CreateCouponDto = {
        code: 'promo10',
        type: CouponType.PERCENTAGE,
        value: 10,
      };

      mockRepository.create.mockResolvedValue(mockCoupon);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCoupon);
    });
  });

  describe('findById', () => {
    it('should return coupon when found', async () => {
      mockRepository.findById.mockResolvedValue(mockCoupon);

      const result = await service.findById('coupon-id-1');

      expect(result).toEqual(mockCoupon);
      expect(repository.findById).toHaveBeenCalledWith('coupon-id-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findById.mockRejectedValue(
        new NotFoundException('Coupon with ID invalid not found'),
      );

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return coupon by code', async () => {
      mockRepository.findByCode.mockResolvedValue(mockCoupon);

      const result = await service.findByCode('PROMO10');

      expect(result).toEqual(mockCoupon);
      expect(repository.findByCode).toHaveBeenCalledWith('PROMO10');
    });
  });

  describe('validateAndCalculate', () => {
    it('should calculate percentage discount correctly', async () => {
      mockRepository.validateForUse.mockResolvedValue(mockCoupon);

      const result = await service.validateAndCalculate({
        code: 'PROMO10',
        subtotal: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10); // 10% of 100
      expect(result.coupon).toEqual({
        id: 'coupon-id-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
      });
    });

    it('should calculate fixed discount correctly', async () => {
      const fixedCoupon = {
        ...mockCoupon,
        type: CouponType.FIXED,
        value: { toNumber: () => 25 } as any,
      };
      mockRepository.validateForUse.mockResolvedValue(fixedCoupon);

      const result = await service.validateAndCalculate({
        code: 'FIXED25',
        subtotal: 100,
      });

      expect(result.discountAmount).toBe(25);
    });

    it('should not allow discount to exceed subtotal', async () => {
      const bigCoupon = {
        ...mockCoupon,
        type: CouponType.FIXED,
        value: { toNumber: () => 200 } as any,
      };
      mockRepository.validateForUse.mockResolvedValue(bigCoupon);

      const result = await service.validateAndCalculate({
        code: 'BIG',
        subtotal: 100,
      });

      expect(result.discountAmount).toBe(100); // capped at subtotal
    });

    it('should throw when coupon is invalid', async () => {
      mockRepository.validateForUse.mockRejectedValue(
        new BadRequestException('Invalid coupon code'),
      );

      await expect(
        service.validateAndCalculate({ code: 'INVALID', subtotal: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when minimum purchase not met', async () => {
      mockRepository.validateForUse.mockRejectedValue(
        new BadRequestException('Minimum purchase of R$ 50.00 required'),
      );

      await expect(service.validateAndCalculate({ code: 'PROMO10', subtotal: 30 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markAsUsed', () => {
    it('should increment coupon usage', async () => {
      mockRepository.incrementUsage.mockResolvedValue({
        ...mockCoupon,
        usedCount: 6,
      });

      const result = await service.markAsUsed('coupon-id-1');

      expect(repository.incrementUsage).toHaveBeenCalledWith('coupon-id-1');
      expect(result.usedCount).toBe(6);
    });
  });

  describe('update', () => {
    it('should update coupon fields', async () => {
      const updated = { ...mockCoupon, value: 15 };
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.update('coupon-id-1', { value: 15 });

      expect(result.value).toBe(15);
    });
  });

  describe('delete', () => {
    it('should delete coupon', async () => {
      mockRepository.delete.mockResolvedValue(mockCoupon);

      const result = await service.delete('coupon-id-1');

      expect(result).toEqual(mockCoupon);
    });
  });
});
