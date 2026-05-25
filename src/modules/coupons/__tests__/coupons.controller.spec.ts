import { Test, TestingModule } from '@nestjs/testing';
import { CouponsController } from '../coupons.controller';
import { CouponsService } from '../coupons.service';
import { CouponType } from '../dto/create-coupon.dto';
import { NotFoundException } from '@nestjs/common';

describe('CouponsController', () => {
  let controller: CouponsController;
  let service: CouponsService;

  const mockCouponsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    validateAndCalculate: jest.fn(),
    markAsUsed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: mockCouponsService }],
    }).compile();

    controller = module.get<CouponsController>(CouponsController);
    service = module.get<CouponsService>(CouponsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate (público)', () => {
    it('deve validar cupom e calcular desconto', async () => {
      const dto = { code: 'PROMO10', subtotal: 100 };
      const validationResult = {
        valid: true,
        coupon: { id: 'coupon-1', code: 'PROMO10', type: CouponType.PERCENTAGE, value: 10 },
        discountAmount: 10,
        message: 'Discount of R$ 10.00 applied',
      };

      mockCouponsService.validateAndCalculate.mockResolvedValue(validationResult);

      const result = await controller.validateCoupon(dto);

      expect(result).toEqual(validationResult);
      expect(service.validateAndCalculate).toHaveBeenCalledWith(dto);
    });
  });

  describe('create (admin only)', () => {
    it('deve criar cupom', async () => {
      const createDto = {
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        isActive: true,
      };

      const createdCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCouponsService.create.mockResolvedValue(createdCoupon);

      const result = await controller.create(createDto);

      expect(result).toEqual(createdCoupon);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll (admin only)', () => {
    it('deve listar cupons com paginação', async () => {
      const paginatedResult = {
        data: [{ id: '1', code: 'PROMO10', type: CouponType.PERCENTAGE, value: 10 }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockCouponsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 20);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('findOne (admin only)', () => {
    it('deve buscar cupom por ID', async () => {
      const coupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
        isActive: true,
      };

      mockCouponsService.findById.mockResolvedValue(coupon);

      const result = await controller.findOne('coupon-1');

      expect(result).toEqual(coupon);
      expect(service.findById).toHaveBeenCalledWith('coupon-1');
    });

    it('deve lançar NotFoundException se cupom não existir', async () => {
      mockCouponsService.findById.mockRejectedValue(
        new NotFoundException('Coupon with ID coupon-999 not found'),
      );

      await expect(controller.findOne('coupon-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (admin only)', () => {
    it('deve atualizar cupom', async () => {
      const updateDto = { value: 15 };
      const updatedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 15,
        updatedAt: new Date(),
      };

      mockCouponsService.update.mockResolvedValue(updatedCoupon);

      const result = await controller.update('coupon-1', updateDto);

      expect(result).toEqual(updatedCoupon);
      expect(service.update).toHaveBeenCalledWith('coupon-1', updateDto);
    });
  });

  describe('delete (admin only)', () => {
    it('deve deletar cupom', async () => {
      const deletedCoupon = {
        id: 'coupon-1',
        code: 'PROMO10',
        type: CouponType.PERCENTAGE,
        value: 10,
      };

      mockCouponsService.delete.mockResolvedValue(deletedCoupon);

      const result = await controller.remove('coupon-1');

      expect(result).toEqual(deletedCoupon);
      expect(service.delete).toHaveBeenCalledWith('coupon-1');
    });
  });
});
