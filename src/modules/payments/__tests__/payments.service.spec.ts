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

  describe('createPayment', () => {
    it('should create PIX payment with QR code', async () => {
      const paymentIntent = {
        id: 'asaas-pix-1',
        providerData: {
          pix_qr_code: 'qr-base64',
          pix_copy_paste: 'pix-code',
        },
      };

      mockOrdersService.findById.mockResolvedValue({
        user: { email: 'test@test.com', name: 'Test User' },
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

    it('should fallback to default provider if selected is not registered', async () => {
      mockProviderFactory.getRegisteredProviders.mockReturnValue([PaymentProvider.ASAAS]);
      mockOrdersService.findById.mockResolvedValue({ user: {} });
      mockPaymentProvider.createPaymentIntent.mockResolvedValue({
        id: 'pix-1',
        providerData: { pix_qr_code: 'qr', pix_copy_paste: 'code' },
      });
      mockPaymentsRepository.createPixPayment.mockResolvedValue(mockPayment);

      await service.createPayment(
        'order-id-1',
        'user-id-1',
        100,
        'MERCADO_PAGO' as PaymentProvider, // not registered
        PaymentMethod.PIX,
      );

      // Should have fallen back to default (ASAAS)
      expect(mockProviderFactory.getProvider).toHaveBeenCalledWith(PaymentProvider.ASAAS);
    });
  });

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

    it('should throw if payment not found', async () => {
      mockPaymentsRepository.findByProviderTxId.mockResolvedValue(null);

      await expect(service.approvePaymentByProviderTxId('nonexistent', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

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
      expect(result.refundResult).toEqual({ id: 'refund-1' });
    });

    it('should throw if payment is not approved', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment); // PENDING

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
  });

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
  });

  describe('getPayment', () => {
    it('should return payment by ID', async () => {
      mockPaymentsRepository.findById.mockResolvedValue(mockPayment);

      const result = await service.getPayment('payment-id-1');

      expect(result).toEqual(mockPayment);
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment by order ID', async () => {
      mockPaymentsRepository.findByOrderId.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByOrderId('order-id-1');

      expect(result).toEqual(mockPayment);
    });
  });
});
