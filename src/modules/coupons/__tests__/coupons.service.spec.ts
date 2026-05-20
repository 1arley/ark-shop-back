import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from '../coupons.service';
import { CouponsRepository } from '../coupons.repository';
import { NotFoundException } from '@nestjs/common';

// Use string literals instead of CouponType enum to avoid Prisma client issues in tests
type CouponType = 'PERCENTAGE' | 'FIXED';
const PERCENTAGE: CouponType = 'PERCENTAGE';
const FIXED: CouponType = 'FIXED';

describe('CouponsService', () => {
  let service: CouponsService;
  let repository: CouponsRepository;

  const mockCouponsRepository = {
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
      providers: [CouponsService, { provide: CouponsRepository, useValue: mockCouponsRepository }],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    repository = module.get<CouponsRepository>(CouponsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar cupom com sucesso', async () => {
      const createDto = {
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
        isActive: true,
      };

      const createdCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
        minPurchase: null,
        maxUses: null,
        validFrom: null,
        validTo: null,
        isActive: true,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCouponsRepository.create.mockResolvedValue(createdCoupon);

      const result = await service.create(createDto);

      expect(result).toEqual(createdCoupon);
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findById', () => {
    it('deve encontrar cupom por ID', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
        isActive: true,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCouponsRepository.findById.mockResolvedValue(coupon);

      const result = await service.findById('coupon-1');

      expect(result).toEqual(coupon);
      expect(repository.findById).toHaveBeenCalledWith('coupon-1');
    });

    it('deve lançar NotFoundException se cupom não existir', async () => {
      mockCouponsRepository.findById.mockRejectedValue(
        new NotFoundException('Coupon with ID coupon-999 not found'),
      );

      await expect(service.findById('coupon-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('deve encontrar cupom por código', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
        isActive: true,
      };

      mockCouponsRepository.findByCode.mockResolvedValue(coupon);

      const result = await service.findByCode('PROMO10');

      expect(result).toEqual(coupon);
      expect(repository.findByCode).toHaveBeenCalledWith('PROMO10');
    });

    it('deve retornar null se cupom não existir', async () => {
      mockCouponsRepository.findByCode.mockResolvedValue(null);

      const result = await service.findByCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('deve listar cupons com paginação', async () => {
      const paginatedResult = {
        data: [
          { id: '1', code: 'PROMO10', type: PERCENTAGE, value: 10 },
          { id: '2', code: 'FIXED20', type: FIXED, value: 20 },
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      };

      mockCouponsRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(repository.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('update', () => {
    it('deve atualizar cupom com sucesso', async () => {
      const updateDto = { value: 15 };
      const updatedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 15,
        isActive: true,
        updatedAt: new Date(),
      };

      mockCouponsRepository.update.mockResolvedValue(updatedCoupon);

      const result = await service.update('coupon-1', updateDto);

      expect(result).toEqual(updatedCoupon);
      expect(repository.update).toHaveBeenCalledWith('coupon-1', updateDto);
    });
  });

  describe('delete', () => {
    it('deve deletar cupom com sucesso', async () => {
      const deletedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
      };

      mockCouponsRepository.delete.mockResolvedValue(deletedCoupon);

      const result = await service.delete('coupon-1');

      expect(result).toEqual(deletedCoupon);
      expect(repository.delete).toHaveBeenCalledWith('coupon-1');
    });
  });

  describe('validateAndCalculate', () => {
    it('deve calcular desconto percentual corretamente', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: PERCENTAGE,
        value: 10,
        isActive: true,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: null,
        minPurchase: null,
      };

      mockCouponsRepository.validateForUse.mockResolvedValue(coupon);

      const result = await service.validateAndCalculate({ code: 'PROMO10', subtotal: 100 });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.coupon?.code).toBe('PROMO10');
    });

    it('deve calcular desconto fixo corretamente', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'FIXED20',
        type: FIXED,
        value: 20,
        isActive: true,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: null,
        minPurchase: null,
      };

      mockCouponsRepository.validateForUse.mockResolvedValue(coupon);

      const result = await service.validateAndCalculate({ code: 'FIXED20', subtotal: 100 });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20);
    });

    it('deve limitar desconto ao subtotal quando desconto excede subtotal', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'FIXED200',
        type: FIXED,
        value: 200,
        isActive: true,
        usedCount: 0,
        maxUses: null,
        validFrom: null,
        validTo: null,
        minPurchase: null,
      };

      mockCouponsRepository.validateForUse.mockResolvedValue(coupon);

      const result = await service.validateAndCalculate({ code: 'FIXED200', subtotal: 50 });

      expect(result.discountAmount).toBe(50);
      expect(result.message).toContain('R$ 50.00');
    });
  });

  describe('markAsUsed', () => {
    it('deve marcar cupom como usado', async () => {
      const updatedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        usedCount: 1,
      };

      mockCouponsRepository.incrementUsage.mockResolvedValue(updatedCoupon);

      const result = await service.markAsUsed('coupon-1');

      expect(result).toEqual(updatedCoupon);
      expect(repository.incrementUsage).toHaveBeenCalledWith('coupon-1');
    });
  });
});
