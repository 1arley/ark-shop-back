import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PaymentsRepository } from '../payments.repository';
import { PaymentProviderFactory } from '../payment-provider.factory';
import { OrdersService } from '@/modules/orders/orders.service';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let _paymentsRepository: PaymentsRepository;
  let _providerFactory: PaymentProviderFactory;
  let ordersService: OrdersService;

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
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: 'order-id-1',
      userId: 'user-id-1',
      status: OrderStatus.PENDING,
      total: 100,
      items: [],
    },
    user: { id: 'user-id-1', email: 'test@test.com' },
  };

  const mockApprovedPayment = {
    ...mockPayment,
    status: PaymentStatus.APPROVED,
  };

  const mockPaymentProvider = {
    createPaymentIntent: jest.fn(),
    verifyPayment: jest.fn(),
    refundPayment: jest.fn(),
  };

  const mockPaymentsRepository = {
    createPayment: jest.fn(),
    createPixPayment: jest.fn(),
    findById: jest.fn(),
    findByOrderId: jest.fn(),
    findByProviderTxId: jest.fn(),
    approvePayment: jest.fn(),
    rejectPayment: jest.fn(),
    updatePaymentStatus: jest.fn(),
    getPaymentsByUser: jest.fn(),
  };

  const mockProviderFactory = {
    getDefaultProvider: jest.fn().mockReturnValue(PaymentProvider.ASAAS),
    getProvider: jest.fn().mockReturnValue(mockPaymentProvider),
    getRegisteredProviders: jest.fn().mockReturnValue([PaymentProvider.ASAAS]),
  };

  const mockOrdersService = {
    findById: jest.fn(),
    deliverOrder: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: mockPaymentsRepository },
        { provide: PaymentProviderFactory, useValue: mockProviderFactory },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    _paymentsRepository = module.get<PaymentsRepository>(PaymentsRepository);
    _providerFactory = module.get<PaymentProviderFactory>(PaymentProviderFactory);
    ordersService = module.get<OrdersService>(OrdersService);

    jest.clearAllMocks();
  });

  // ─── createPayment ───────────────────────────────────────────────
  describe('createPayment', () => {
    it('should reject payment when amount does not match order total', async () => {
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 200,
        user: { id: 'user-id-1', email: 'test@test.com', name: 'Test User' },
      });

      await expect(
        service.createPayment(
          'order-id-1',
          'user-id-1',
          100,
          PaymentProvider.ASAAS,
          PaymentMethod.PIX,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createPayment(
          'order-id-1',
          'user-id-1',
          100,
          PaymentProvider.ASAAS,
          PaymentMethod.PIX,
        ),
      ).rejects.toThrow('Payment amount does not match order total');
    });

    it('should create PIX payment with QR code', async () => {
      const paymentIntent = {
        id: 'asaas-pix-1',
        providerData: {
          pix_qr_code: 'qr-base64',
          pix_copy_paste: 'pix-code',
        },
      };

      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1', email: 'test@test.com', name: 'Test User' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue(paymentIntent);
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      const result = await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
      );

      expect(mockPaymentProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          currency: 'BRL',
          orderId: 'order-id-1',
          method: PaymentMethod.PIX,
        }),
      );
      expect(mockPaymentsRepository.createPixPayment).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should create PIX payment com dados do pagador', async () => {
      const paymentIntent = {
        id: 'asaas-pix-2',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      };

      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 50,
        user: { id: 'user-id-1', email: 'user@email.com', name: 'João Silva' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue(paymentIntent);
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        50,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
        '123.456.789-00',
        '1990-01-01',
      );

      expect(mockPaymentProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          payerCpf: '123.456.789-00',
          payerBirthDate: '1990-01-01',
          payerEmail: 'user@email.com',
          payerName: 'João Silva',
        }),
      );
    });

    it('should create PIX payment sem dados do usuário quando order não tem user', async () => {
      const paymentIntent = {
        id: 'asaas-pix-3',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      };

      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue(paymentIntent);
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
      );

      expect(mockPaymentProvider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          payerEmail: undefined,
          payerName: undefined,
        }),
      );
    });

    it('should create PIX payment com QR code vazio quando providerData não tem pix_qr_code', async () => {
      const paymentIntent = {
        id: 'asaas-pix-4',
        providerData: {},
      };

      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue(paymentIntent);
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
      );

      expect(mockPaymentsRepository.createPixPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        expect.objectContaining({
          pixQrCode: '',
          pixCode: '',
        }),
      );
    });

    it('should create standard payment for non-PIX method', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([PaymentProvider.ASAAS]);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentsRepository.createPayment.mockResolvedValue(mockPayment);

      const result = await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.CREDIT_CARD,
      );

      expect(mockPaymentsRepository.createPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.CREDIT_CARD,
      );
      expect(mockOrdersService.findById).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(mockPayment);
    });

    it('should fallback to default provider if selected is not registered', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([PaymentProvider.ASAAS]);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        'MERCADO_PAGO' as PaymentProvider,
        PaymentMethod.PIX,
      );

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(PaymentProvider.ASAAS);
    });

    it('should use explicit provider when registered', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([PaymentProvider.ASAAS]);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
      );

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(PaymentProvider.ASAAS);
    });

    it('should use default provider when none specified', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([PaymentProvider.ASAAS]);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment('order-id-1', 'user-id-1', 100, undefined, PaymentMethod.PIX);

      expect(mockProviderFactory.getDefaultProvider).toHaveBeenCalled();
      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(PaymentProvider.ASAAS);
    });

    it('should create PIX payment com expiresAt em 15 minutos', async () => {
      const fixedDate = Date.parse('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fixedDate);

      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
      );

      expect(mockPaymentsRepository.createPixPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        100,
        PaymentProvider.ASAAS,
        expect.objectContaining({
          expiresAt: new Date('2026-01-01T00:15:00.000Z'),
        }),
      );

      jest.useRealTimers();
    });

    it('should fallback para default quando fallback provider também não está registrado', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([]);
      mockProviderFactory.getDefaultProvider.mockReturnValue(PaymentProvider.ASAAS);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        total: 100,
        user: { id: 'user-id-1' },
      });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        'STRIPE' as PaymentProvider,
        PaymentMethod.PIX,
      );

      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(PaymentProvider.ASAAS);
    });
  });

  // ─── processPayment ──────────────────────────────────────────────
  describe('processPayment', () => {
    it('should approve payment when provider returns approved', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);
      mockPaymentProvider.verifyPayment.mockResolvedValue({ status: 'approved' });
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);

      const result = await service.processPayment('payment-id-1', 'asaas-tx-1');

      expect(mockPaymentsRepository.approvePayment).toHaveBeenCalledWith(
        'payment-id-1',
        'asaas-tx-1',
        undefined,
      );
      expect(result).toEqual(mockApprovedPayment);
    });

    it('should approve payment with webhookData', async () => {
      const webhookData = { event: 'PAYMENT_RECEIVED' };
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);
      mockPaymentProvider.verifyPayment.mockResolvedValue({ status: 'approved' });
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);

      const result = await service.processPayment('payment-id-1', 'asaas-tx-1', webhookData);

      expect(mockPaymentsRepository.approvePayment).toHaveBeenCalledWith(
        'payment-id-1',
        'asaas-tx-1',
        webhookData,
      );
      expect(result).toEqual(mockApprovedPayment);
    });

    it('should reject payment when provider returns non-approved', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);
      mockPaymentProvider.verifyPayment.mockResolvedValue({ status: 'pending' });
      mockPaymentsRepository.rejectPayment.mockResolvedValue(undefined);

      const result = await service.processPayment('payment-id-1', 'asaas-tx-1');

      expect(mockPaymentsRepository.rejectPayment).toHaveBeenCalledWith(
        'payment-id-1',
        'Payment not approved',
      );
      expect(result).toBeUndefined();
    });

    it('should throw BadRequestException when payment already processed', async () => {
      const rejectedPayment = { ...mockPayment, status: PaymentStatus.REJECTED };
      mockPaymentsRepository.findById.mockResolvedValue(rejectedPayment);

      await expect(service.processPayment('payment-id-1', 'asaas-tx-1')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.processPayment('payment-id-1', 'asaas-tx-1')).rejects.toThrow(
        'Payment already processed (status: REJECTED)',
      );
    });

    it('should throw when payment is already approved', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockApprovedPayment);

      await expect(service.processPayment('payment-id-1', 'asaas-tx-1')).rejects.toThrow(
        'Payment already processed (status: APPROVED)',
      );
    });
  });

  // ─── refundPayment ───────────────────────────────────────────────
  describe('refundPayment', () => {
    it('should refund approved payment', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockApprovedPayment);
      mockPaymentProvider.refundPayment.mockResolvedValue({ id: 'refund-1' });
      mockPaymentsRepository.updatePaymentStatus.mockResolvedValue({
        ...mockApprovedPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await service.refundPayment('payment-id-1');

      expect(mockPaymentProvider.refundPayment).toHaveBeenCalledWith('asaas-tx-1', undefined);
      expect(mockPaymentsRepository.updatePaymentStatus).toHaveBeenCalledWith(
        'payment-id-1',
        PaymentStatus.REFUNDED,
        undefined,
        { refundResult: { id: 'refund-1' } },
      );
      expect(result.refundResult).toEqual({ id: 'refund-1' });
    });

    it('should refund approved payment with partial amount', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockApprovedPayment);
      mockPaymentProvider.refundPayment.mockResolvedValue({ id: 'refund-2', value: 50 });
      mockPaymentsRepository.updatePaymentStatus.mockResolvedValue({
        ...mockApprovedPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await service.refundPayment('payment-id-1', 50);

      expect(mockPaymentProvider.refundPayment).toHaveBeenCalledWith('asaas-tx-1', 50);
      expect(result.refundResult).toEqual({ id: 'refund-2', value: 50 });
    });

    it('should throw if payment is not approved', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);

      await expect(service.refundPayment('payment-id-1')).rejects.toThrow(
        'Can only refund approved payments',
      );
    });

    it('should throw if payment is rejected', async () => {
      const rejectedPayment = { ...mockPayment, status: PaymentStatus.REJECTED };
      mockPaymentsRepository.findById.mockResolvedValue(rejectedPayment);

      await expect(service.refundPayment('payment-id-1')).rejects.toThrow(
        'Can only refund approved payments',
      );
    });

    it('should throw if payment missing providerTxId', async () => {
      const paymentNoTx = { ...mockApprovedPayment, providerTxId: null };
      mockPaymentsRepository.findById.mockResolvedValue(paymentNoTx);

      await expect(service.refundPayment('payment-id-1')).rejects.toThrow(
        'Payment missing provider transaction ID',
      );
    });

    it('should throw if providerTxId is undefined', async () => {
      const paymentNoTx = { ...mockApprovedPayment, providerTxId: undefined };
      mockPaymentsRepository.findById.mockResolvedValue(paymentNoTx);

      await expect(service.refundPayment('payment-id-1')).rejects.toThrow(
        'Payment missing provider transaction ID',
      );
    });
  });

  // ─── getPayment ──────────────────────────────────────────────────
  describe('getPayment', () => {
    it('should return payment by ID', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);

      const result = await service.getPayment('payment-id-1');

      expect(result).toEqual(mockPayment);
      expect(mockPaymentsRepository.findById).toHaveBeenCalledWith('payment-id-1');
    });
  });

  // ─── getPaymentByOrderId ─────────────────────────────────────────
  describe('getPaymentByOrderId', () => {
    it('should return payment by order ID', async () => {
      mockPaymentsRepository.findByOrderId.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByOrderId('order-id-1');

      expect(result).toEqual(mockPayment);
      expect(mockPaymentsRepository.findByOrderId).toHaveBeenCalledWith('order-id-1');
    });

    it('should return null when no payment exists for order', async () => {
      mockPaymentsRepository.findByOrderId.mockResolvedValue(null);

      const result = await service.getPaymentByOrderId('order-id-999');

      expect(result).toBeNull();
    });
  });

  // ─── getUserPayments ─────────────────────────────────────────────
  describe('getUserPayments', () => {
    it('should return paginated payments for user', async () => {
      const paginatedResult = {
        data: [mockPayment],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockPaymentsRepository.getPaymentsByUser.mockResolvedValue(paginatedResult);

      const result = await service.getUserPayments('user-id-1', 1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockPaymentsRepository.getPaymentsByUser).toHaveBeenCalledWith('user-id-1', 1, 10);
    });

    it('should use default pagination values', async () => {
      mockPaymentsRepository.getPaymentsByUser.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await service.getUserPayments('user-id-1');

      expect(mockPaymentsRepository.getPaymentsByUser).toHaveBeenCalledWith('user-id-1', 1, 10);
    });

    it('should handle custom pagination', async () => {
      mockPaymentsRepository.getPaymentsByUser.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 3, limit: 5, totalPages: 0 },
      });

      await service.getUserPayments('user-id-1', 3, 5);

      expect(mockPaymentsRepository.getPaymentsByUser).toHaveBeenCalledWith('user-id-1', 3, 5);
    });
  });

  // ─── verifyPaymentWithProvider ───────────────────────────────────
  describe('verifyPaymentWithProvider', () => {
    it('should verify payment with provider when found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockPayment);
      mockPaymentProvider.verifyPayment.mockResolvedValue({ status: 'approved', amount: 100 });

      const result = await service.verifyPaymentWithProvider('asaas-tx-1');

      expect(mockPaymentProvider.verifyPayment).toHaveBeenCalledWith('asaas-tx-1');
      expect(result).toEqual({ status: 'approved', amount: 100 });
    });

    it('should throw BadRequestException when payment not found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(null);

      await expect(service.verifyPaymentWithProvider('nonexistent-tx')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.verifyPaymentWithProvider('nonexistent-tx')).rejects.toThrow(
        'Payment not found',
      );
    });
  });

  // ─── approvePayment ──────────────────────────────────────────────
  describe('approvePayment', () => {
    it('should approve payment and deliver order', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.PAID };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);
      mockOrdersService.deliverOrder.mockResolvedValue(undefined);

      const result = await service.approvePayment('payment-id-1', { id: 'asaas-tx-1' });

      expect(mockPaymentsRepository.approvePayment).toHaveBeenCalledWith(
        'payment-id-1',
        'asaas-tx-1',
        { id: 'asaas-tx-1' },
      );
      expect(mockOrdersService.deliverOrder).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(mockApprovedPayment);
    });

    it('should not deliver order when already delivered', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.DELIVERED };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);

      await service.approvePayment('payment-id-1', { id: 'asaas-tx-1' });

      expect(mockOrdersService.deliverOrder).not.toHaveBeenCalled();
    });

    it('should not throw when delivery fails', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.PAID };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);
      mockOrdersService.deliverOrder.mockRejectedValue(new Error('Delivery failed'));

      await expect(service.approvePayment('payment-id-1', { id: 'asaas-tx-1' })).resolves.toEqual(
        mockApprovedPayment,
      );
    });

    it('should not throw when order not found during delivery', async () => {
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(null);

      await expect(service.approvePayment('payment-id-1', { id: 'asaas-tx-1' })).resolves.toEqual(
        mockApprovedPayment,
      );
    });
  });

  // ─── rejectPayment ───────────────────────────────────────────────
  describe('rejectPayment', () => {
    it('should reject payment with reason', async () => {
      mockPaymentsRepository.rejectPayment.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REJECTED,
      });

      await service.rejectPayment('payment-id-1', 'Fraud detected');

      expect(mockPaymentsRepository.rejectPayment).toHaveBeenCalledWith(
        'payment-id-1',
        'Fraud detected',
      );
    });

    it('should reject payment without reason', async () => {
      mockPaymentsRepository.rejectPayment.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REJECTED,
      });

      await service.rejectPayment('payment-id-1', undefined);

      expect(mockPaymentsRepository.rejectPayment).toHaveBeenCalledWith('payment-id-1', undefined);
    });
  });

  // ─── approvePaymentByProviderTxId ────────────────────────────────
  describe('approvePaymentByProviderTxId', () => {
    it('should approve payment and deliver order', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockPayment);
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue({
        id: 'order-id-1',
        status: OrderStatus.PAID,
      });

      const result = await service.approvePaymentByProviderTxId('asaas-tx-1', {
        id: 'asaas-tx-1',
      });

      expect(mockPaymentsRepository.approvePayment).toHaveBeenCalled();
      expect(ordersService.findById).toHaveBeenCalledWith('order-id-1');
      expect(ordersService.deliverOrder).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(mockApprovedPayment);
    });

    it('should be idempotent — skip if already approved', async () => {
      const alreadyApproved = { ...mockPayment, status: PaymentStatus.APPROVED };
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(alreadyApproved);

      const result = await service.approvePaymentByProviderTxId('asaas-tx-1', {});

      expect(mockPaymentsRepository.approvePayment).not.toHaveBeenCalled();
      expect(ordersService.deliverOrder).not.toHaveBeenCalled();
      expect(result).toEqual(alreadyApproved);
    });

    it('should be idempotent — skip if order status is PAID', async () => {
      const paymentWithPaidOrder = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
        order: { status: OrderStatus.PAID },
      };
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(paymentWithPaidOrder);

      const result = await service.approvePaymentByProviderTxId('asaas-tx-1', {});

      expect(mockPaymentsRepository.approvePayment).not.toHaveBeenCalled();
      expect(ordersService.deliverOrder).not.toHaveBeenCalled();
      expect(result).toEqual(paymentWithPaidOrder);
    });

    it('should throw if payment not found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(null);

      await expect(service.approvePaymentByProviderTxId('nonexistent', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject NaN paymentInfo.value (locale format protection)', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockPayment);

      // Simulate Brazilian locale format "59,90" which Number() converts to NaN
      // Without NaN protection, this bypasses the amount check silently
      const paymentInfoWithNaN = { id: 'asaas-tx-1', value: '59,90' };

      await expect(
        service.approvePaymentByProviderTxId('asaas-tx-1', paymentInfoWithNaN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── rejectPaymentByProviderTxId ─────────────────────────────────
  describe('rejectPaymentByProviderTxId', () => {
    it('should reject payment by provider transaction ID', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockPayment);
      mockPaymentsRepository.rejectPayment.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REJECTED,
      });

      const result = await service.rejectPaymentByProviderTxId('asaas-tx-1', 'Cancelled by user');

      expect(mockPaymentsRepository.rejectPayment).toHaveBeenCalledWith(
        'payment-id-1',
        'Cancelled by user',
      );
      expect(result).toEqual(expect.objectContaining({ status: PaymentStatus.REJECTED }));
    });

    it('should throw if payment not found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(null);

      await expect(service.rejectPaymentByProviderTxId('nonexistent-tx', 'reason')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.rejectPaymentByProviderTxId('nonexistent-tx', 'reason')).rejects.toThrow(
        'Payment not found',
      );
    });
  });

  // ─── refundPaymentByProviderTxId ─────────────────────────────────
  describe('refundPaymentByProviderTxId', () => {
    it('should refund payment by provider transaction ID', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockApprovedPayment);
      mockPaymentsRepository.findById.mockResolvedValue(mockApprovedPayment);
      mockPaymentProvider.refundPayment.mockResolvedValue({ id: 'refund-1' });
      mockPaymentsRepository.updatePaymentStatus.mockResolvedValue({
        ...mockApprovedPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await service.refundPaymentByProviderTxId('asaas-tx-1');

      expect(result.refundResult).toEqual({ id: 'refund-1' });
    });

    it('should refund with partial amount', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockApprovedPayment);
      mockPaymentsRepository.findById.mockResolvedValue(mockApprovedPayment);
      mockPaymentProvider.refundPayment.mockResolvedValue({ id: 'refund-2', value: 30 });
      mockPaymentsRepository.updatePaymentStatus.mockResolvedValue({
        ...mockApprovedPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await service.refundPaymentByProviderTxId('asaas-tx-1', 30);

      expect(mockPaymentProvider.refundPayment).toHaveBeenCalledWith('asaas-tx-1', 30);
      expect(result.refundResult).toEqual({ id: 'refund-2', value: 30 });
    });

    it('should throw if payment not found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(null);

      await expect(service.refundPaymentByProviderTxId('nonexistent-tx')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if payment is not approved', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(mockPayment);
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);

      await expect(service.refundPaymentByProviderTxId('asaas-tx-1')).rejects.toThrow(
        'Can only refund approved payments',
      );
    });
  });

  // ─── deliverOrderByPayment ───────────────────────────────────────
  describe('deliverOrderByPayment (via approvePayment)', () => {
    it('should deliver order successfully', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.PAID };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);
      mockOrdersService.deliverOrder.mockResolvedValue(undefined);

      await service.approvePayment('payment-id-1', { id: 'asaas-tx-1' });

      expect(mockOrdersService.deliverOrder).toHaveBeenCalledWith('order-id-1');
    });

    it('should not deliver when order already delivered', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.DELIVERED };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);

      await service.approvePayment('payment-id-1', { id: 'asaas-tx-1' });

      expect(mockOrdersService.deliverOrder).not.toHaveBeenCalled();
    });

    it('should not throw when order is null', async () => {
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(null);

      await expect(service.approvePayment('payment-id-1', { id: 'asaas-tx-1' })).resolves.toEqual(
        mockApprovedPayment,
      );

      expect(mockOrdersService.deliverOrder).not.toHaveBeenCalled();
    });

    it('should not throw when delivery throws error', async () => {
      const order = { id: 'order-id-1', status: OrderStatus.PAID };
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockResolvedValue(order);
      mockOrdersService.deliverOrder.mockRejectedValue(new Error('Network error'));

      await expect(service.approvePayment('payment-id-1', { id: 'asaas-tx-1' })).resolves.toEqual(
        mockApprovedPayment,
      );
    });

    it('should not throw when findById during delivery throws', async () => {
      mockPaymentsRepository.approvePayment.mockResolvedValue(mockApprovedPayment);
      mockOrdersService.findById.mockImplementationOnce(() => Promise.resolve(mockApprovedPayment));
      mockOrdersService.findById.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      await expect(service.approvePayment('payment-id-1', { id: 'asaas-tx-1' })).resolves.toEqual(
        mockApprovedPayment,
      );
    });
  });
});
