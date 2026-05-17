import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { OrdersRepository } from '../orders.repository';
import { KeysService } from '@/modules/keys/keys.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { OrderStatus, KeyStatus } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: OrdersRepository;
  let _keysService: KeysService;
  let couponsService: CouponsService;

  const mockOrder = {
    id: 'order-id-1',
    userId: 'user-id-1',
    status: OrderStatus.PENDING,
    subtotal: 100,
    total: 100,
    discountAmount: 0,
    couponId: null,
    items: [
      {
        id: 'item-id-1',
        orderId: 'order-id-1',
        productId: 'product-id-1',
        quantity: 1,
        price: 100,
        key: null,
        product: { id: 'product-id-1', name: 'Game Key', price: 100 },
      },
    ],
    payment: null,
    user: { id: 'user-id-1', email: 'test@test.com', name: 'Test User' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeliveredOrder = {
    ...mockOrder,
    status: OrderStatus.DELIVERED,
    items: [
      {
        ...mockOrder.items[0],
        key: {
          id: 'key-id-1',
          status: KeyStatus.DELIVERED,
          deliveredAt: new Date(),
          keyData: 'encrypted-data',
        },
      },
    ],
  };

  const mockOrdersRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByUser: jest.fn(),
    updateStatus: jest.fn(),
    cancel: jest.fn(),
    getRecentOrders: jest.fn(),
    getProductsByIds: jest.fn(),
    deliverOrderAtomic: jest.fn(),
  };

  const mockKeysService = {
    getDecryptedKey: jest.fn(),
  };

  const mockCouponsService = {
    validateAndCalculate: jest.fn(),
    markAsUsed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: mockOrdersRepository },
        { provide: KeysService, useValue: mockKeysService },
        { provide: CouponsService, useValue: mockCouponsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ordersRepository = module.get<OrdersRepository>(OrdersRepository);
    _keysService = module.get<KeysService>(KeysService);
    couponsService = module.get<CouponsService>(CouponsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create order without coupon', async () => {
      mockOrdersRepository.create.mockResolvedValue(mockOrder);

      const result = await service.create(
        { items: [{ productId: 'product-id-1', quantity: 1 }] },
        'user-id-1',
      );

      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 'product-id-1', quantity: 1 }],
        }),
        'user-id-1',
        undefined,
      );
      expect(couponsService.validateAndCalculate).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should create order with coupon discount', async () => {
      const validationResult = {
        valid: true,
        coupon: { id: 'coupon-id-1', code: 'PROMO10', type: 'PERCENTAGE', value: 10 },
        discountAmount: 10,
        message: 'Discount applied',
      };

      mockOrdersRepository.getProductsByIds.mockResolvedValue([
        { id: 'product-id-1', name: 'Game', price: { toNumber: () => 100 }, isActive: true },
      ]);
      mockCouponsService.validateAndCalculate.mockResolvedValue(validationResult);
      mockOrdersRepository.create.mockResolvedValue({
        ...mockOrder,
        total: 90,
        discountAmount: 10,
        couponId: 'coupon-id-1',
      });

      await service.create(
        { items: [{ productId: 'product-id-1', quantity: 1 }], couponCode: 'PROMO10' },
        'user-id-1',
      );

      expect(couponsService.validateAndCalculate).toHaveBeenCalledWith({
        code: 'PROMO10',
        subtotal: 100,
      });
      expect(couponsService.markAsUsed).toHaveBeenCalledWith('coupon-id-1');
      expect(ordersRepository.create).toHaveBeenCalledWith(expect.any(Object), 'user-id-1', {
        couponId: 'coupon-id-1',
        discountAmount: 10,
      });
    });

    it('should throw if coupon is invalid', async () => {
      mockOrdersRepository.getProductsByIds.mockResolvedValue([
        { id: 'product-id-1', name: 'Game', price: { toNumber: () => 100 }, isActive: true },
      ]);
      mockCouponsService.validateAndCalculate.mockResolvedValue({
        valid: false,
        discountAmount: 0,
        message: 'Invalid coupon',
      });

      await expect(
        service.create(
          { items: [{ productId: 'product-id-1', quantity: 1 }], couponCode: 'INVALID' },
          'user-id-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return order when found', async () => {
      mockOrdersRepository.findById.mockResolvedValue(mockOrder);

      const result = await service.findById('order-id-1');

      expect(result).toEqual(mockOrder);
    });
  });

  describe('findByUser', () => {
    it('should return paginated orders for user', async () => {
      const paginatedResult = {
        data: [mockOrder],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockOrdersRepository.findByUser.mockResolvedValue(paginatedResult);

      const result = await service.findByUser('user-id-1', 1, 10);

      expect(result).toEqual(paginatedResult);
    });
  });

  describe('deliverOrder', () => {
    it('should deliver order with PAID status', async () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      mockOrdersRepository.findById.mockResolvedValue(paidOrder);
      mockOrdersRepository.deliverOrderAtomic.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.DELIVERED,
      });

      await service.deliverOrder('order-id-1');

      expect(ordersRepository.deliverOrderAtomic).toHaveBeenCalledWith(
        'order-id-1',
        paidOrder.items,
      );
    });

    it('should throw if order is not PAID', async () => {
      mockOrdersRepository.findById.mockResolvedValue(mockOrder); // PENDING

      await expect(service.deliverOrder('order-id-1')).rejects.toThrow(
        'Cannot deliver order with status: PENDING',
      );
    });

    it('should throw if order not found', async () => {
      mockOrdersRepository.findById.mockResolvedValue(null);

      await expect(service.deliverOrder('nonexistent')).rejects.toThrow('Order not found');
    });
  });

  describe('downloadKeys', () => {
    it('should return decrypted keys for delivered order', async () => {
      mockOrdersRepository.findById.mockResolvedValue(mockDeliveredOrder);
      mockKeysService.getDecryptedKey.mockResolvedValue('XXXX-YYYY-ZZZZ');

      const result = await service.downloadKeys('order-id-1', 'user-id-1');

      expect(result.orderId).toBe('order-id-1');
      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(result.keys).toHaveLength(1);
      expect(result.keys?.[0]?.decryptedKey).toBe('XXXX-YYYY-ZZZZ');
    });

    it('should throw if not order owner', async () => {
      mockOrdersRepository.findById.mockResolvedValue(mockDeliveredOrder);

      await expect(service.downloadKeys('order-id-1', 'other-user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if order not delivered', async () => {
      mockOrdersRepository.findById.mockResolvedValue(mockOrder); // PENDING

      await expect(service.downloadKeys('order-id-1', 'user-id-1')).rejects.toThrow(
        'Order not delivered yet',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel order', async () => {
      mockOrdersRepository.cancel.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancel('order-id-1');

      expect(ordersRepository.cancel).toHaveBeenCalledWith('order-id-1');
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      mockOrdersRepository.updateStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PROCESSING,
      });

      await service.updateStatus('order-id-1', OrderStatus.PROCESSING);

      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(
        'order-id-1',
        OrderStatus.PROCESSING,
      );
    });
  });

  describe('getRecentOrders', () => {
    it('should return recent orders', async () => {
      mockOrdersRepository.getRecentOrders.mockResolvedValue([mockOrder]);

      const result = await service.getRecentOrders(10);

      expect(result).toEqual([mockOrder]);
    });
  });
});
