import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from '../payments.repository';
import { PaymentProviderFactory } from '../payment-provider.factory';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';

describe('PaymentsRepository', () => {
  let repository: PaymentsRepository;
  let _prisma: PrismaService;

  const mockPaymentProvider = {
    createPaymentIntent: jest.fn(),
    verifyPayment: jest.fn(),
    refundPayment: jest.fn(),
  };

  const mockProviderFactory = {
    getDefaultProvider: jest.fn().mockReturnValue(PaymentProvider.ASAAS),
    getProvider: jest.fn().mockReturnValue(mockPaymentProvider),
    getRegisteredProviders: jest.fn().mockReturnValue([PaymentProvider.ASAAS]),
  };

  const mockPrismaPayment = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockPrisma = {
    payment: mockPrismaPayment,
    order: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPayment = {
    id: 'payment-id-1',
    orderId: 'order-id-1',
    userId: 'user-id-1',
    provider: PaymentProvider.ASAAS,
    providerTxId: 'asaas-tx-1',
    amount: 100,
    status: PaymentStatus.PENDING,
    method: PaymentMethod.PIX,
    pixQrCode: 'qr-code-data',
    pixCode: 'pix-copy-paste',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: 'order-id-1',
      userId: 'user-id-1',
      status: OrderStatus.PENDING,
      total: 100,
      items: [],
    },
    user: { id: 'user-id-1', email: 'test@test.com', name: 'Test User' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsRepository,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    repository = module.get<PaymentsRepository>(PaymentsRepository);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  // ─── createPayment ───────────────────────────────────────────────
  describe('createPayment', () => {
    it('should create a standard payment record', async () => {
      mockPrismaPayment.create.mockResolvedValue(mockPayment);

      const result = await repository.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.CREDIT_CARD,
      );

      expect(mockPrismaPayment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-id-1',
          userId: 'user-id-1',
          provider: PaymentProvider.ASAAS,
          method: PaymentMethod.CREDIT_CARD,
          amount: 100,
          status: PaymentStatus.PENDING,
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(mockPayment);
    });
  });

  // ─── createPixPayment ────────────────────────────────────────────
  describe('createPixPayment', () => {
    it('should create PIX payment with all pix data', async () => {
      const pixData = {
        providerTxId: 'asaas-tx-1',
        pixQrCode: 'qr-base64',
        pixCode: 'pix-copy-paste',
        expiresAt: new Date('2026-01-01T00:15:00.000Z'),
      };
      mockPrismaPayment.create.mockResolvedValue(mockPayment);

      const result = await repository.createPixPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        pixData,
      );

      expect(mockPrismaPayment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-id-1',
          userId: 'user-id-1',
          provider: PaymentProvider.ASAAS,
          method: PaymentMethod.PIX,
          amount: 100,
          status: PaymentStatus.PENDING,
          pixQrCode: 'qr-base64',
          pixCode: 'pix-copy-paste',
          providerTxId: 'asaas-tx-1',
          expiresAt: new Date('2026-01-01T00:15:00.000Z'),
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should create PIX payment with minimal data (no providerTxId, no expiresAt)', async () => {
      const pixData = {
        pixQrCode: 'qr-base64',
        pixCode: 'pix-copy-paste',
      };
      mockPrismaPayment.create.mockResolvedValue(mockPayment);

      const result = await repository.createPixPayment(
        'order-id-1',
        'user-id-1',
        50,
        PaymentProvider.ASAAS,
        pixData,
      );

      expect(mockPrismaPayment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-id-1',
          userId: 'user-id-1',
          provider: PaymentProvider.ASAAS,
          method: PaymentMethod.PIX,
          amount: 50,
          status: PaymentStatus.PENDING,
          pixQrCode: 'qr-base64',
          pixCode: 'pix-copy-paste',
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(mockPayment);
    });
  });

  // ─── findById ────────────────────────────────────────────────────
  describe('findById', () => {
    it('should return payment when found', async () => {
      mockPrismaPayment.findUnique.mockResolvedValue(mockPayment);

      const result = await repository.findById('payment-id-1');

      expect(mockPrismaPayment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id-1' },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
          user: { select: expect.any(Object) },
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPrismaPayment.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nonexistent-id')).rejects.toThrow(NotFoundException);

      await expect(repository.findById('nonexistent-id')).rejects.toThrow(
        'Payment with ID nonexistent-id not found',
      );
    });
  });

  // ─── findByOrderId ───────────────────────────────────────────────
  describe('findByOrderId', () => {
    it('should return payment when found', async () => {
      mockPrismaPayment.findUnique.mockResolvedValue(mockPayment);

      const result = await repository.findByOrderId('order-id-1');

      expect(mockPrismaPayment.findUnique).toHaveBeenCalledWith({
        where: { orderId: 'order-id-1' },
        include: {
          order: true,
          user: { select: expect.any(Object) },
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should return null when no payment exists for order', async () => {
      mockPrismaPayment.findUnique.mockResolvedValue(null);

      const result = await repository.findByOrderId('order-id-999');

      expect(result).toBeNull();
    });
  });

  // ─── updatePaymentStatus ─────────────────────────────────────────
  describe('updatePaymentStatus', () => {
    it('should update payment status with providerTxId', async () => {
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.APPROVED,
        providerTxId: 'new-tx',
      };
      mockPrismaPayment.update.mockResolvedValue(updatedPayment);

      const result = await repository.updatePaymentStatus(
        'payment-id-1',
        PaymentStatus.APPROVED,
        'new-tx',
      );

      expect(mockPrismaPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id-1' },
        data: {
          status: PaymentStatus.APPROVED,
          providerTxId: 'new-tx',
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(updatedPayment);
    });

    it('should update payment status with webhookData', async () => {
      const webhookData = { event: 'PAYMENT_RECEIVED', payment: { id: 'asaas-tx-1' } };
      const updatedPayment = { ...mockPayment, status: PaymentStatus.APPROVED, webhookData };
      mockPrismaPayment.update.mockResolvedValue(updatedPayment);

      const result = await repository.updatePaymentStatus(
        'payment-id-1',
        PaymentStatus.APPROVED,
        undefined,
        webhookData,
      );

      expect(mockPrismaPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id-1' },
        data: {
          status: PaymentStatus.APPROVED,
          webhookData,
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(updatedPayment);
    });

    it('should update payment status with both providerTxId and webhookData', async () => {
      const webhookData = { event: 'PAYMENT_CONFIRMED' };
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.APPROVED,
        providerTxId: 'tx-1',
        webhookData,
      };
      mockPrismaPayment.update.mockResolvedValue(updatedPayment);

      const result = await repository.updatePaymentStatus(
        'payment-id-1',
        PaymentStatus.APPROVED,
        'tx-1',
        webhookData,
      );

      expect(mockPrismaPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id-1' },
        data: {
          status: PaymentStatus.APPROVED,
          providerTxId: 'tx-1',
          webhookData,
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(updatedPayment);
    });

    it('should update payment status without optional fields', async () => {
      const updatedPayment = { ...mockPayment, status: PaymentStatus.REFUNDED };
      mockPrismaPayment.update.mockResolvedValue(updatedPayment);

      const result = await repository.updatePaymentStatus('payment-id-1', PaymentStatus.REFUNDED);

      expect(mockPrismaPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id-1' },
        data: {
          status: PaymentStatus.REFUNDED,
        },
        include: {
          order: true,
        },
      });
      expect(result).toEqual(updatedPayment);
    });
  });

  // ─── approvePayment ──────────────────────────────────────────────
  describe('approvePayment', () => {
    it('should approve payment and update order to PAID', async () => {
      const updatedPayment = { ...mockPayment, status: PaymentStatus.APPROVED };

      const transactionMock = jest.fn(async cb => {
        const mockTx = {
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue(updatedPayment),
          },
          order: { update: jest.fn().mockResolvedValue({ status: OrderStatus.PAID }) },
        };
        return cb(mockTx);
      });
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.approvePayment('payment-id-1', 'asaas-tx-1', {
        event: 'PAYMENT_RECEIVED',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(updatedPayment);
    });

    it('should approve payment without webhookData', async () => {
      const updatedPayment = { ...mockPayment, status: PaymentStatus.APPROVED };

      const transactionMock = jest.fn(async cb => {
        const mockTx = {
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue(updatedPayment),
          },
          order: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(mockTx);
      });
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.approvePayment('payment-id-1', 'asaas-tx-1');

      expect(result).toEqual(updatedPayment);
    });
  });

  // ─── rejectPayment ───────────────────────────────────────────────
  describe('rejectPayment', () => {
    it('should reject payment and update order to CANCELLED', async () => {
      const transactionMock = jest.fn(async cb => {
        const mockTx = {
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({ status: PaymentStatus.REJECTED }),
          },
          order: { update: jest.fn().mockResolvedValue({ status: OrderStatus.CANCELLED }) },
        };
        return cb(mockTx);
      });
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.rejectPayment('payment-id-1', 'Fraud detected');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // rejectPayment returns the result of $transaction which is undefined (no return in callback)
      expect(result).toBeUndefined();
    });

    it('should reject payment without reason', async () => {
      const transactionMock = jest.fn(async cb => {
        const mockTx = {
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({ status: PaymentStatus.REJECTED }),
          },
          order: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(mockTx);
      });
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.rejectPayment('payment-id-1');

      // rejectPayment returns the result of $transaction which is undefined (no return in callback)
      expect(result).toBeUndefined();
    });
  });

  // ─── getPaymentsByUser ───────────────────────────────────────────
  describe('getPaymentsByUser', () => {
    it('should return paginated payments for user', async () => {
      const payments = [mockPayment];
      const total = 5;

      const transactionMock = jest.fn(async () => [payments, total]);
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.getPaymentsByUser('user-id-1', 1, 10);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        data: payments,
        meta: {
          total,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should calculate correct skip for page 2', async () => {
      const transactionMock = jest.fn(async () => [[], 0]);
      mockPrisma.$transaction.mockImplementation(transactionMock);

      await repository.getPaymentsByUser('user-id-1', 2, 5);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should use default pagination values', async () => {
      const transactionMock = jest.fn(async () => [[], 0]);
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.getPaymentsByUser('user-id-1');

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should calculate totalPages correctly', async () => {
      const transactionMock = jest.fn(async () => [[], 25]);
      mockPrisma.$transaction.mockImplementation(transactionMock);

      const result = await repository.getPaymentsByUser('user-id-1', 1, 10);

      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── findByProviderTxId ──────────────────────────────────────────
  describe('findByProviderTxId', () => {
    it('should return payment when found by providerTxId', async () => {
      mockPrismaPayment.findFirst.mockResolvedValue(mockPayment);

      const result = await repository.findByProviderTxId('asaas-tx-1');

      expect(mockPrismaPayment.findFirst).toHaveBeenCalledWith({
        where: { providerTxId: 'asaas-tx-1' },
        include: {
          order: true,
          user: { select: expect.any(Object) },
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should return null when no payment found by providerTxId', async () => {
      mockPrismaPayment.findFirst.mockResolvedValue(null);

      const result = await repository.findByProviderTxId('nonexistent-tx');

      expect(result).toBeNull();
    });
  });
});
