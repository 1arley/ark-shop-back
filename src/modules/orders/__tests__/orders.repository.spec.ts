import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersRepository } from '../orders.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { OrderStatus, KeyStatus } from '@prisma/client';

describe('OrdersRepository', () => {
  let repository: OrdersRepository;
  let prisma: PrismaService;
  let keysEncryption: KeysEncryptionProvider;

  const mockPrismaService = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    key: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    account: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockKeysEncryption = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    encryptBatch: jest.fn(),
    decryptBatch: jest.fn(),
    generateSecureKey: jest.fn(),
  };

  const mockProduct = {
    id: 'product-id-1',
    name: 'Game Key',
    price: 100,
    isActive: true,
    stock: 10,
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
        keyId: null,
        key: null,
        product: mockProduct,
      },
    ],
    payment: null,
    coupon: null,
    user: { id: 'user-id-1', email: 'test@test.com', name: 'Test User' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KeysEncryptionProvider, useValue: mockKeysEncryption },
      ],
    }).compile();

    repository = module.get<OrdersRepository>(OrdersRepository);
    prisma = module.get<PrismaService>(PrismaService);
    keysEncryption = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);

    jest.clearAllMocks();
    mockPrismaService.key.count.mockResolvedValue(0);
    mockPrismaService.account.count.mockResolvedValue(0);
    mockPrismaService.product.findUnique.mockResolvedValue({ productType: 'KEY' });
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criar pedido com itens e calcular subtotal corretamente', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 2 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      const result = await repository.create(createOrderDto, 'user-id-1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['product-id-1'] } },
      });
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-id-1',
          status: OrderStatus.PENDING,
          subtotal: 200,
          total: 200,
          discountAmount: 0,
          couponId: null,
          items: {
            create: [
              {
                productId: 'product-id-1',
                quantity: 1,
                price: mockProduct.price,
              },
              {
                productId: 'product-id-1',
                quantity: 1,
                price: mockProduct.price,
              },
            ],
          },
        }),
        include: {
          items: { include: { product: true } },
          payment: true,
          coupon: true,
        },
      });
      expect(result).toEqual(mockOrder);
    });

    it('deve criar pedido com dados de cupom', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
        couponCode: 'PROMO10',
      };
      const couponData = { couponId: 'coupon-id-1', discountAmount: 10 };
      const orderWithCoupon = {
        ...mockOrder,
        couponId: 'coupon-id-1',
        discountAmount: 10,
        total: 90,
      };

      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.order.create.mockResolvedValue(orderWithCoupon);

      const result = await repository.create(createOrderDto, 'user-id-1', couponData);

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subtotal: 100,
          total: 90,
          discountAmount: 10,
          couponId: 'coupon-id-1',
        }),
        include: {
          items: { include: { product: true } },
          payment: true,
          coupon: true,
        },
      });
      expect(result.total).toBe(90);
    });

    it('deve criar pedido sem cupom quando couponData nao fornecido', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      await repository.create(createOrderDto, 'user-id-1');

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          discountAmount: 0,
          couponId: null,
        }),
        include: expect.any(Object),
      });
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-id-999', quantity: 1 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        'Product product-id-999 not found',
      );
    });

    it('deve lancar BadRequestException quando produto esta inativo', async () => {
      const inactiveProduct = { ...mockProduct, isActive: false };
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 1 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([inactiveProduct]);

      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        'Product Game Key is not active',
      );
    });

    it('deve lancar BadRequestException quando quantidade excede estoque', async () => {
      const lowStockProduct = { ...mockProduct, stock: 1 };
      const createOrderDto = {
        items: [{ productId: 'product-id-1', quantity: 2 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([lowStockProduct]);

      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.create(createOrderDto, 'user-id-1')).rejects.toThrow(
        'Insufficient stock for product Game Key. Available: 1, requested: 2',
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('deve criar pedido com multiplos itens', async () => {
      const product2 = {
        id: 'product-id-2',
        name: 'Game 2',
        price: 50,
        isActive: true,
      };
      const createOrderDto = {
        items: [
          { productId: 'product-id-1', quantity: 1 },
          { productId: 'product-id-2', quantity: 3 },
        ],
      };

      mockPrismaService.product.findMany.mockResolvedValue([mockProduct, product2]);
      mockPrismaService.order.create.mockResolvedValue({
        ...mockOrder,
        subtotal: 250,
        total: 250,
        items: [
          { ...mockOrder.items[0], productId: 'product-id-1', quantity: 1 },
          { ...mockOrder.items[0], id: 'item-id-2', productId: 'product-id-2', quantity: 3 },
        ],
      });

      const result = await repository.create(createOrderDto, 'user-id-1');

      expect(result.subtotal).toBe(250);
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subtotal: 250,
          total: 250,
        }),
        include: expect.any(Object),
      });
    });
  });

  // ─── findById ─────────────────────────────────────────────────────
  describe('findById', () => {
    it('deve retornar pedido quando encontrado', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await repository.findById('order-id-1');

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-id-1' },
        include: {
          user: { select: expect.any(Object) },
          items: {
            include: {
              product: true,
              key: {
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              account: {
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          payment: true,
        },
      });
      expect(result).toEqual({
        ...mockOrder,
        items: mockOrder.items.map(item => ({ ...item, account: null })),
      });
    });

    it('deve lancar NotFoundException quando pedido nao existe', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(repository.findById('nonexistent')).rejects.toThrow(
        'Order with ID nonexistent not found',
      );
    });
  });

  // ─── findByUser ───────────────────────────────────────────────────
  describe('findByUser', () => {
    it('deve retornar pedidos paginados do usuario', async () => {
      const orders = [mockOrder];
      mockPrismaService.$transaction.mockResolvedValue([orders, 1]);

      const result = await repository.findByUser('user-id-1', 1, 10);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.data).toEqual([
        {
          ...mockOrder,
          items: mockOrder.items.map(item => ({ ...item, account: null })),
        },
      ]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('deve retornar lista vazia quando usuario nao tem pedidos', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await repository.findByUser('user-id-1', 1, 10);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('deve calcular paginacao corretamente para pagina 2', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 25]);

      await repository.findByUser('user-id-1', 2, 10);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('deve atualizar status de PENDING para AWAITING_PAYMENT', async () => {
      const updatedOrder = { ...mockOrder, status: OrderStatus.AWAITING_PAYMENT };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.AWAITING_PAYMENT);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-id-1' },
        data: { status: OrderStatus.AWAITING_PAYMENT },
        include: { items: true, payment: true },
      });
      expect(result.status).toBe(OrderStatus.AWAITING_PAYMENT);
    });

    it('deve atualizar status de AWAITING_PAYMENT para PAID', async () => {
      const awaitingOrder = { ...mockOrder, status: OrderStatus.AWAITING_PAYMENT };
      const updatedOrder = { ...mockOrder, status: OrderStatus.PAID };
      mockPrismaService.order.findUnique.mockResolvedValue(awaitingOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.PAID);

      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('deve atualizar status de PAID para DELIVERED', async () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      const updatedOrder = { ...mockOrder, status: OrderStatus.DELIVERED };
      mockPrismaService.order.findUnique.mockResolvedValue(paidOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.DELIVERED);

      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('deve atualizar status de PAID para PROCESSING', async () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      const updatedOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      mockPrismaService.order.findUnique.mockResolvedValue(paidOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.PROCESSING);

      expect(result.status).toBe(OrderStatus.PROCESSING);
    });

    it('deve atualizar status de PROCESSING para DELIVERED', async () => {
      const processingOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      const updatedOrder = { ...mockOrder, status: OrderStatus.DELIVERED };
      mockPrismaService.order.findUnique.mockResolvedValue(processingOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.DELIVERED);

      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('deve atualizar status de PENDING para CANCELLED', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(cancelledOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('deve atualizar status de AWAITING_PAYMENT para CANCELLED', async () => {
      const awaitingOrder = { ...mockOrder, status: OrderStatus.AWAITING_PAYMENT };
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockPrismaService.order.findUnique.mockResolvedValue(awaitingOrder);
      mockPrismaService.order.update.mockResolvedValue(cancelledOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('deve atualizar status de PROCESSING para CANCELLED', async () => {
      const processingOrder = { ...mockOrder, status: OrderStatus.PROCESSING };
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockPrismaService.order.findUnique.mockResolvedValue(processingOrder);
      mockPrismaService.order.update.mockResolvedValue(cancelledOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('deve atualizar status de PAID para REFUNDED', async () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      const refundedOrder = { ...mockOrder, status: OrderStatus.REFUNDED };
      mockPrismaService.order.findUnique.mockResolvedValue(paidOrder);
      mockPrismaService.order.update.mockResolvedValue(refundedOrder);

      const result = await repository.updateStatus('order-id-1', OrderStatus.REFUNDED);

      expect(result.status).toBe(OrderStatus.REFUNDED);
    });

    it('deve lancar BadRequestException para transicao invalida (DELIVERED -> PENDING)', async () => {
      const deliveredOrder = { ...mockOrder, status: OrderStatus.DELIVERED };
      mockPrismaService.order.findUnique.mockResolvedValue(deliveredOrder);

      await expect(repository.updateStatus('order-id-1', OrderStatus.PENDING)).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.updateStatus('order-id-1', OrderStatus.PENDING)).rejects.toThrow(
        'Invalid status transition from DELIVERED to PENDING',
      );
    });

    it('deve lancar BadRequestException para transicao invalida (CANCELLED -> PENDING)', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockPrismaService.order.findUnique.mockResolvedValue(cancelledOrder);

      await expect(repository.updateStatus('order-id-1', OrderStatus.PENDING)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lancar BadRequestException para transicao invalida (REFUNDED -> PENDING)', async () => {
      const refundedOrder = { ...mockOrder, status: OrderStatus.REFUNDED };
      mockPrismaService.order.findUnique.mockResolvedValue(refundedOrder);

      await expect(repository.updateStatus('order-id-1', OrderStatus.PENDING)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve liberar chaves reservadas ao cancelar pedido', async () => {
      const orderWithReservedKey = {
        ...mockOrder,
        status: OrderStatus.AWAITING_PAYMENT,
        items: [
          {
            ...mockOrder.items[0],
            keyId: 'key-id-1',
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(orderWithReservedKey);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(prisma.key.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['key-id-1'] } },
        data: {
          status: KeyStatus.AVAILABLE,
          orderItemId: null,
        },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 0 },
      });
    });

    it('deve liberar chaves reservadas ao fazer refund', async () => {
      const orderWithReservedKey = {
        ...mockOrder,
        status: OrderStatus.PAID,
        items: [
          {
            ...mockOrder.items[0],
            keyId: 'key-id-1',
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(orderWithReservedKey);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.REFUNDED,
      });

      await repository.updateStatus('order-id-1', OrderStatus.REFUNDED);

      expect(prisma.key.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['key-id-1'] } },
        data: {
          status: KeyStatus.AVAILABLE,
          orderItemId: null,
        },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 0 },
      });
    });

    it('deve liberar accounts reservadas e sincronizar estoque ao cancelar pedido', async () => {
      const orderWithReservedAccount = {
        ...mockOrder,
        status: OrderStatus.PROCESSING,
        items: [
          {
            ...mockOrder.items[0],
            keyId: null,
            accountId: 'account-id-1',
          },
        ],
      };
      mockPrismaService.product.findUnique.mockResolvedValue({ productType: 'ACCOUNT' });
      mockPrismaService.order.findUnique.mockResolvedValue(orderWithReservedAccount);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['account-id-1'] } },
        data: {
          status: KeyStatus.AVAILABLE,
          orderItemId: null,
        },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 0 },
      });
    });

    it('nao deve chamar updateMany quando nao ha chaves reservadas no cancelamento', async () => {
      const orderWithoutKeys = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        items: [{ ...mockOrder.items[0], keyId: null }],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(orderWithoutKeys);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await repository.updateStatus('order-id-1', OrderStatus.CANCELLED);

      expect(prisma.key.updateMany).not.toHaveBeenCalled();
    });

    it('deve lancar NotFoundException quando pedido nao existe', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(repository.updateStatus('nonexistent', OrderStatus.PAID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────
  describe('cancel', () => {
    it('deve delegar para updateStatus com CANCELLED', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(cancelledOrder);

      const result = await repository.cancel('order-id-1');

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-id-1' },
        include: {
          items: {
            where: { OR: [{ keyId: { not: null } }, { accountId: { not: null } }] },
            select: { id: true, productId: true, keyId: true, accountId: true },
          },
        },
      });
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  // ─── getRecentOrders ──────────────────────────────────────────────
  describe('getRecentOrders', () => {
    it('deve retornar pedidos recentes com limite padrao', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);

      const result = await repository.getRecentOrders();

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        take: 10,
        include: {
          user: { select: expect.any(Object) },
          items: {
            include: {
              product: true,
              key: {
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                },
              },
              account: {
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        {
          ...mockOrder,
          items: mockOrder.items.map(item => ({ ...item, account: null })),
        },
      ]);
    });

    it('deve retornar pedidos recentes com limite customizado', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([mockOrder, mockOrder]);

      const result = await repository.getRecentOrders(5);

      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
      expect(result).toHaveLength(2);
    });
  });

  // ─── getProductsByIds ─────────────────────────────────────────────
  describe('getProductsByIds', () => {
    it('deve buscar produtos por IDs em batch', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await repository.getProductsByIds(['product-id-1', 'product-id-2']);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['product-id-1', 'product-id-2'] } },
      });
      expect(result).toEqual([mockProduct]);
    });

    it('deve retornar lista vazia quando nenhum produto encontrado', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await repository.getProductsByIds(['nonexistent']);

      expect(result).toEqual([]);
    });
  });

  // ─── reserveAvailableKey ──────────────────────────────────────────
  describe('reserveAvailableKey', () => {
    it('deve reservar chave disponivel com sucesso', async () => {
      const reservedKey = {
        id: 'key-id-1',
        productId: 'product-id-1',
        status: KeyStatus.RESERVED,
        orderItemId: 'item-id-1',
        product: mockProduct,
      };

      mockPrismaService.key.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.key.findFirst.mockResolvedValue(reservedKey);

      const result = await repository.reserveAvailableKey('product-id-1', 'item-id-1');

      expect(prisma.key.updateMany).toHaveBeenCalledWith({
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId: 'item-id-1',
        },
      });
      expect(result).toEqual(reservedKey);
    });

    it('deve retornar null quando nao ha chaves disponiveis', async () => {
      mockPrismaService.key.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.reserveAvailableKey('product-id-1', 'item-id-1');

      expect(result).toBeNull();
      expect(prisma.key.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('reserveAvailableAccount', () => {
    it('deve reservar somente a account selecionada com sucesso', async () => {
      const availableAccount = {
        id: 'account-id-1',
        productId: 'product-id-1',
        status: KeyStatus.AVAILABLE,
      };
      const reservedAccount = {
        ...availableAccount,
        status: KeyStatus.RESERVED,
        orderItemId: 'item-id-1',
        product: mockProduct,
      };

      mockPrismaService.account.findFirst
        .mockResolvedValueOnce(availableAccount)
        .mockResolvedValueOnce(reservedAccount);
      mockPrismaService.account.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.reserveAvailableAccount('product-id-1', 'item-id-1');

      expect(prisma.account.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
      });
      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'account-id-1',
          status: KeyStatus.AVAILABLE,
        },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId: 'item-id-1',
        },
      });
      expect(result).toEqual(reservedAccount);
    });

    it('deve retornar null quando nao ha accounts disponiveis', async () => {
      mockPrismaService.account.findFirst.mockResolvedValue(null);

      const result = await repository.reserveAvailableAccount('product-id-1', 'item-id-1');

      expect(result).toBeNull();
      expect(prisma.account.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── deliverKey ───────────────────────────────────────────────────
  describe('deliverKey', () => {
    it('deve marcar chave como entregue e retornar com dados descriptografados', async () => {
      const deliveredKey = {
        id: 'key-id-1',
        status: KeyStatus.DELIVERED,
        deliveredAt: new Date(),
        keyData: 'v2:encrypted-data',
        product: mockProduct,
        orderItem: null,
      };

      mockPrismaService.key.update.mockResolvedValue({
        ...deliveredKey,
        keyData: 'v2:encrypted-data',
      });
      mockKeysEncryption.decrypt.mockReturnValue('XXXX-YYYY-ZZZZ');

      const result = await repository.deliverKey('key-id-1');

      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: {
          status: KeyStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
        include: {
          product: true,
          orderItem: true,
        },
      });
      expect(keysEncryption.decrypt).toHaveBeenCalledWith('v2:encrypted-data');
      expect(result.decryptedKey).toBe('XXXX-YYYY-ZZZZ');
    });
  });

  // ─── deliverOrderAtomic ───────────────────────────────────────────
  describe('deliverOrderAtomic', () => {
    it('deve reservar chaves e marcar pedido como entregue com sucesso', async () => {
      const items = [
        {
          id: 'item-id-1',
          productId: 'product-id-1',
          quantity: 1,
          key: null,
          account: null,
          product: { name: 'Game Key', productType: 'KEY' },
        },
      ];
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }),
          update: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED }),
        },
        key: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue({ id: 'key-id-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        account: {
          count: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        product: {
          findUnique: jest.fn().mockResolvedValue({ productType: 'KEY' }),
          update: jest.fn().mockResolvedValue({}),
        },
        orderItem: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      const result = await repository.deliverOrderAtomic('order-id-1', items);

      expect(mockTx.key.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
      });
      expect(mockTx.key.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'key-id-1',
          status: KeyStatus.AVAILABLE,
        },
        data: {
          status: KeyStatus.DELIVERED,
          deliveredAt: expect.any(Date),
          orderItemId: 'item-id-1',
        },
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-id-1' },
        data: { status: OrderStatus.DELIVERED },
        include: { items: true, payment: true },
      });
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 0 },
      });
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('deve reservar accounts e marcar pedido como entregue com sucesso', async () => {
      const items = [
        {
          id: 'item-id-1',
          productId: 'product-id-1',
          quantity: 1,
          key: null,
          account: null,
          product: { name: 'Game Account', productType: 'ACCOUNT' },
        },
      ];
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }),
          update: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED }),
        },
        key: {
          count: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        account: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue({ id: 'account-id-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        product: {
          findUnique: jest.fn().mockResolvedValue({ productType: 'ACCOUNT' }),
          update: jest.fn().mockResolvedValue({}),
        },
        orderItem: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      const result = await repository.deliverOrderAtomic('order-id-1', items);

      expect(mockTx.account.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
      });
      expect(mockTx.account.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'account-id-1',
          status: KeyStatus.AVAILABLE,
        },
        data: {
          status: KeyStatus.DELIVERED,
          deliveredAt: expect.any(Date),
          orderItemId: 'item-id-1',
        },
      });
      expect(mockTx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item-id-1' },
        data: { accountId: 'account-id-1' },
      });
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 0 },
      });
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('deve lancar BadRequestException quando nao ha chaves disponiveis para produto', async () => {
      const items = [
        {
          id: 'item-id-1',
          productId: 'product-id-1',
          quantity: 1,
          key: null,
          account: null,
          product: { name: 'Game Key', productType: 'KEY' },
        },
      ];
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }),
          update: jest.fn(),
        },
        key: {
          count: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
          updateMany: jest.fn(),
        },
        account: {
          count: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        product: {
          findUnique: jest.fn().mockResolvedValue({ productType: 'KEY' }),
          update: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      await expect(repository.deliverOrderAtomic('order-id-1', items)).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.deliverOrderAtomic('order-id-1', items)).rejects.toThrow(
        'No available keys for product: Game Key',
      );
    });

    it('deve lancar BadRequestException quando chave ja foi reservada por outra transacao', async () => {
      const items = [
        {
          id: 'item-id-1',
          productId: 'product-id-1',
          quantity: 1,
          key: null,
          account: null,
          product: { name: 'Game Key', productType: 'KEY' },
        },
      ];
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }),
          update: jest.fn(),
        },
        key: {
          count: jest.fn(),
          findFirst: jest.fn().mockResolvedValue({ id: 'key-id-1' }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        account: {
          count: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        product: {
          findUnique: jest.fn().mockResolvedValue({ productType: 'KEY' }),
          update: jest.fn(),
        },
        orderItem: { update: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      await expect(repository.deliverOrderAtomic('order-id-1', items)).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.deliverOrderAtomic('order-id-1', items)).rejects.toThrow(
        'No available keys for product: Game Key',
      );
    });

    it('nao deve reservar chave quando item ja possui chave atribuida', async () => {
      const items = [
        {
          id: 'item-id-1',
          productId: 'product-id-1',
          quantity: 1,
          key: {
            id: 'key-id-1',
            status: KeyStatus.RESERVED,
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveredAt: null,
          },
          account: null,
          product: { name: 'Game Key', productType: 'KEY' },
        },
      ];
      const mockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }),
          update: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.DELIVERED }),
        },
        key: { count: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
        account: { count: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
        product: {
          findUnique: jest.fn().mockResolvedValue({ productType: 'KEY' }),
          update: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      await repository.deliverOrderAtomic('order-id-1', items);

      expect(mockTx.key.findFirst).not.toHaveBeenCalled();
      expect(mockTx.key.updateMany).not.toHaveBeenCalled();
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.order.update).toHaveBeenCalled();
    });
  });
});
