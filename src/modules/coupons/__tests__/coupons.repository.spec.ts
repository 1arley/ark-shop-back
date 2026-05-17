import { Test, TestingModule } from '@nestjs/testing';
import { CouponsRepository } from '../coupons.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CouponType } from '@prisma/client';

describe('CouponsRepository', () => {
  let repository: CouponsRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    coupon: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CouponsRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<CouponsRepository>(CouponsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar cupom com sucesso', async () => {
      const createDto = {
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        minPurchase: 50,
        maxUses: 100,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-12-31T23:59:59Z',
        isActive: true,
      };

      const createdCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        minPurchase: 50,
        maxUses: 100,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: new Date('2026-12-31T23:59:59Z'),
        isActive: true,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.coupon.create.mockResolvedValue(createdCoupon);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdCoupon);
      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: {
          code: 'PROMO10',
          type: CouponType.PERCENTAGE,
          value: 10,
          minPurchase: 50,
          maxUses: 100,
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validTo: new Date('2026-12-31T23:59:59Z'),
          isActive: true,
        },
      });
    });
  });

  describe('findById', () => {
    it('deve encontrar cupom por ID', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        isActive: true,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      const result = await repository.findById('coupon-1');

      expect(result).toEqual(coupon);
      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
    });

    it('deve lançar NotFoundException se cupom não existir', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);

      await expect(repository.findById('coupon-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('deve encontrar cupom por código (case-insensitive)', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      const result = await repository.findByCode('promo10');

      expect(result).toEqual(coupon);
      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'PROMO10' },
      });
    });

    it('deve retornar null se cupom não existir', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);

      const result = await repository.findByCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('deve listar cupons com paginação', async () => {
      const coupons = [
        { id: '1', code: 'PROMO10', type: CouponType.PERCENTAGE, value: 10 },
        { id: '2', code: 'FIXED20', type: CouponType.FIXED, value: 20 },
      ];

      mockPrismaService.$transaction.mockResolvedValue([coupons, 2]);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('update', () => {
    it('deve atualizar cupom com sucesso', async () => {
      const existingCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        isActive: true,
      };

      const updatedCoupon = {
        ...existingCoupon,
        value: 15,
        updatedAt: new Date(),
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(existingCoupon);
      mockPrismaService.coupon.update.mockResolvedValue(updatedCoupon);

      const result = await repository.update('coupon-1', { value: 15 });

      expect(result).toEqual(updatedCoupon);
      expect(prisma.coupon.update).toHaveBeenCalled();
    });

    it('deve validar existência antes de atualizar', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);

      await expect(repository.update('coupon-999', { value: 15 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.coupon.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deve deletar cupom com sucesso', async () => {
      const existingCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(existingCoupon);
      mockPrismaService.coupon.delete.mockResolvedValue(existingCoupon);

      const result = await repository.delete('coupon-1');

      expect(result).toEqual(existingCoupon);
      expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
    });
  });

  describe('validateForUse', () => {
    it('deve validar cupom válido', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: { toNumber: () => 10 },
        isActive: true,
        usedCount: 0,
        maxUses: 100,
        validFrom: new Date('2025-01-01'),
        validTo: new Date('2027-12-31'),
        minPurchase: { toNumber: () => 10 },
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      const result = await repository.validateForUse('PROMO10', 100);

      expect(result).toEqual(coupon);
    });

    it('deve lançar BadRequestException se cupom não existir', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);

      await expect(repository.validateForUse('INVALID', 100)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se cupom estiver expirado', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'EXPIRED',
        type: CouponType.PERCENTAGE,
        value: { toNumber: () => 10 },
        isActive: true,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: new Date('2020-01-01'),
        minPurchase: null,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      await expect(repository.validateForUse('EXPIRED', 100)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se usos máximos atingidos', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'MAXED',
        type: CouponType.PERCENTAGE,
        value: { toNumber: () => 10 },
        isActive: true,
        usedCount: 100,
        maxUses: 100,
        validFrom: null,
        validTo: new Date('2027-12-31'),
        minPurchase: null,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      await expect(repository.validateForUse('MAXED', 100)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se compra mínima não atingida', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'MIN50',
        type: CouponType.PERCENTAGE,
        value: { toNumber: () => 10 },
        isActive: true,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: new Date('2027-12-31'),
        minPurchase: { toNumber: () => 50 },
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      await expect(repository.validateForUse('MIN50', 30)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se cupom estiver inativo', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'INACTIVE',
        type: CouponType.PERCENTAGE,
        value: { toNumber: () => 10 },
        isActive: false,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: new Date('2027-12-31'),
        minPurchase: null,
      };

      mockPrismaService.coupon.findUnique.mockResolvedValue(coupon);

      await expect(repository.validateForUse('INACTIVE', 100)).rejects.toThrow(BadRequestException);
    });
  });

  describe('incrementUsage', () => {
    it('deve incrementar uso do cupom', async () => {
      const updatedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        usedCount: 1,
      };

      mockPrismaService.coupon.update.mockResolvedValue(updatedCoupon);

      const result = await repository.incrementUsage('coupon-1');

      expect(result).toEqual(updatedCoupon);
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
