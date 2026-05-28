import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { OrderStatus } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: OrdersService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'USER' as const,
    emailVerified: false,
  };

  const mockAdminUser = {
    id: 'admin-id-1',
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
    emailVerified: false,
  };

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

  const mockOrdersService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    cancel: jest.fn(),
    getRecentOrders: jest.fn(),
    deliverOrder: jest.fn(),
    downloadItems: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get<OrdersService>(OrdersService);

    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criar um pedido com sucesso (usuario autenticado)', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
      };
      mockOrdersService.create.mockResolvedValue(mockOrder);

      const result = await controller.create(createOrderDto, mockUser);

      expect(ordersService.create).toHaveBeenCalledWith(createOrderDto, mockUser.id);
      expect(result).toEqual(mockOrder);
    });

    it('deve criar um pedido com cupom de desconto', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
        couponCode: 'PROMO10',
      };
      const orderWithCoupon = {
        ...mockOrder,
        couponId: 'coupon-id-1',
        discountAmount: 10,
        total: 90,
      };
      mockOrdersService.create.mockResolvedValue(orderWithCoupon);

      const result = await controller.create(createOrderDto, mockUser);

      expect(ordersService.create).toHaveBeenCalledWith(createOrderDto, mockUser.id);
      expect(result).toEqual(orderWithCoupon);
    });

    it('deve lancar BadRequestException quando dados invalidos', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
      };
      mockOrdersService.create.mockRejectedValue(new BadRequestException('Product not found'));

      await expect(controller.create(createOrderDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findByUser (findAll) ─────────────────────────────────────────
  describe('findAll (findByUser)', () => {
    it('deve retornar pedidos do usuario com paginacao padrao', async () => {
      const paginatedResult = {
        data: [mockOrder],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockOrdersService.findByUser.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(mockUser, 1, 10);

      expect(ordersService.findByUser).toHaveBeenCalledWith(mockUser.id, 1, 10);
      expect(result).toEqual(paginatedResult);
    });

    it('deve retornar pedidos com paginacao customizada', async () => {
      const paginatedResult = {
        data: [],
        meta: { total: 0, page: 3, limit: 5, totalPages: 0 },
      };
      mockOrdersService.findByUser.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(mockUser, 3, 5);

      expect(ordersService.findByUser).toHaveBeenCalledWith(mockUser.id, 3, 5);
      expect(result).toEqual(paginatedResult);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('deve retornar pedido quando proprietario', async () => {
      mockOrdersService.findById.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-id-1', mockUser);

      expect(ordersService.findById).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(mockOrder);
    });

    it('deve retornar pedido quando admin (mesmo nao sendo proprietario)', async () => {
      mockOrdersService.findById.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-id-1', mockAdminUser);

      expect(result).toEqual(mockOrder);
    });

    it('deve lancar ForbiddenException quando nao e proprietario e nao e admin', async () => {
      const otherUser = { ...mockUser, id: 'other-user-id' };
      mockOrdersService.findById.mockResolvedValue(mockOrder);

      await expect(controller.findOne('order-id-1', otherUser)).rejects.toThrow(ForbiddenException);
      await expect(controller.findOne('order-id-1', otherUser)).rejects.toThrow(
        'You can only view your own orders',
      );
    });

    it('deve permitir SUPERADMIN visualizar qualquer pedido', async () => {
      const superAdminUser = { ...mockAdminUser, role: 'SUPERADMIN' as const };
      mockOrdersService.findById.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-id-1', superAdminUser);

      expect(result).toEqual(mockOrder);
    });
  });

  // ─── downloadKeys ─────────────────────────────────────────────────
  describe('downloadKeys', () => {
    it('deve retornar chaves descriptografadas para pedido entregue', async () => {
      const downloadResult = {
        orderId: 'order-id-1',
        status: OrderStatus.DELIVERED,
        keys: [
          {
            productName: 'Game Key',
            keyId: 'key-id-1',
            deliveredAt: new Date(),
            decryptedKey: 'XXXX-YYYY-ZZZZ',
          },
        ],
      };
      mockOrdersService.downloadItems.mockResolvedValue(downloadResult);

      const result = await controller.downloadItems('order-id-1', mockUser);

      expect(ordersService.downloadItems).toHaveBeenCalledWith('order-id-1', mockUser.id);
      expect(result).toEqual(downloadResult);
    });

    it('deve lancar BadRequestException quando pedido nao esta entregue', async () => {
      mockOrdersService.downloadItems.mockRejectedValue(
        new BadRequestException('Order not delivered yet'),
      );

      await expect(controller.downloadItems('order-id-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lancar ForbiddenException quando usuario nao e proprietario', async () => {
      mockOrdersService.downloadItems.mockRejectedValue(
        new ForbiddenException('You can only download keys from your own orders'),
      );

      await expect(controller.downloadItems('order-id-1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getRecentOrders ──────────────────────────────────────────────
  describe('findRecent (getRecentOrders)', () => {
    it('deve retornar pedidos recentes com limite padrao', async () => {
      mockOrdersService.getRecentOrders.mockResolvedValue([mockOrder]);

      const result = await controller.findRecent(10);

      expect(ordersService.getRecentOrders).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockOrder]);
    });

    it('deve retornar pedidos recentes com limite customizado', async () => {
      mockOrdersService.getRecentOrders.mockResolvedValue([mockOrder, mockOrder]);

      const result = await controller.findRecent(5);

      expect(ordersService.getRecentOrders).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(2);
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────
  describe('cancel', () => {
    it('deve cancelar pedido com sucesso quando proprietario', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockOrdersService.findById.mockResolvedValue(mockOrder);
      mockOrdersService.cancel.mockResolvedValue(cancelledOrder);

      const result = await controller.cancel('order-id-1', mockUser);

      expect(ordersService.findById).toHaveBeenCalledWith('order-id-1');
      expect(ordersService.cancel).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(cancelledOrder);
    });

    it('deve lancar ForbiddenException quando nao e proprietario', async () => {
      const otherUser = { ...mockUser, id: 'other-user-id' };
      mockOrdersService.findById.mockResolvedValue(mockOrder);

      await expect(controller.cancel('order-id-1', otherUser)).rejects.toThrow(ForbiddenException);
      await expect(controller.cancel('order-id-1', otherUser)).rejects.toThrow(
        'You can only cancel your own orders',
      );
      expect(ordersService.cancel).not.toHaveBeenCalled();
    });

    it('deve lancar NotFoundException quando pedido nao existe', async () => {
      mockOrdersService.findById.mockRejectedValue(new BadRequestException('Order not found'));

      await expect(controller.cancel('nonexistent', mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('deve atualizar status do pedido (admin)', async () => {
      const updatedOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      mockOrdersService.updateStatus.mockResolvedValue(updatedOrder);

      const result = await controller.updateStatus('order-id-1', OrderStatus.PROCESSING);

      expect(ordersService.updateStatus).toHaveBeenCalledWith('order-id-1', OrderStatus.PROCESSING);
      expect(result).toEqual(updatedOrder);
    });

    it('deve lancar BadRequestException para transicao invalida', async () => {
      mockOrdersService.updateStatus.mockRejectedValue(
        new BadRequestException('Invalid status transition from DELIVERED to PENDING'),
      );

      await expect(controller.updateStatus('order-id-1', OrderStatus.PENDING)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── deliver ──────────────────────────────────────────────────────
  describe('deliver', () => {
    it('deve entregar pedido com sucesso (admin)', async () => {
      const deliveredOrder = { ...mockOrder, status: OrderStatus.DELIVERED };
      mockOrdersService.deliverOrder.mockResolvedValue(deliveredOrder);

      const result = await controller.deliver('order-id-1');

      expect(ordersService.deliverOrder).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(deliveredOrder);
    });

    it('deve lancar BadRequestException quando pedido nao esta PAID', async () => {
      mockOrdersService.deliverOrder.mockRejectedValue(
        new BadRequestException('Cannot deliver order with status: PENDING'),
      );

      await expect(controller.deliver('order-id-1')).rejects.toThrow(BadRequestException);
    });
  });
});
