import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { AsaasWebhookHandler } from '../webhooks/asaas-webhook.handler';
import { PaymentProvider, PaymentMethod } from '@prisma/client';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: PaymentsService;

  const mockPaymentsService = {
    createPayment: jest.fn(),
    getPayment: jest.fn(),
    getUserPayments: jest.fn(),
    refundPayment: jest.fn(),
    getPaymentByOrderId: jest.fn(),
  };

  const mockAsaasWebhookHandler = {
    verifySignature: jest.fn(),
    handleEvent: jest.fn(),
  };

  const mockPayment = {
    id: 'payment-id-1',
    orderId: 'order-id-1',
    userId: 'user-id-1',
    provider: PaymentProvider.ASAAS,
    providerTxId: 'asaas-tx-1',
    amount: 100,
    status: 'PENDING',
    method: PaymentMethod.PIX,
    pixQrCode: 'qr-code-data',
    pixCode: 'pix-copy-paste',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: AsaasWebhookHandler, useValue: mockAsaasWebhookHandler },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  // ─── createPayment ───────────────────────────────────────────────
  describe('createPayment', () => {
    it('should create PIX payment successfully', async () => {
      mockPaymentsService.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.createPayment(
        'order-id-1',
        {
          amount: 100,
          method: PaymentMethod.PIX,
        },
        { id: 'user-id-1' },
      );

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        100,
        undefined,
        PaymentMethod.PIX,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockPayment);
    });

    it('should create payment with explicit provider', async () => {
      mockPaymentsService.createPayment.mockResolvedValue(mockPayment);

      await controller.createPayment(
        'order-id-1',
        {
          amount: 50,
          provider: PaymentProvider.ASAAS,
          method: PaymentMethod.PIX,
        },
        { id: 'user-id-1' },
      );

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        50,
        PaymentProvider.ASAAS,
        PaymentMethod.PIX,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should create payment with payer info', async () => {
      mockPaymentsService.createPayment.mockResolvedValue(mockPayment);

      await controller.createPayment(
        'order-id-1',
        {
          amount: 75,
          method: PaymentMethod.PIX,
          payerCpf: '123.456.789-00',
          payerBirthDate: '1990-05-15',
        },
        { id: 'user-id-1' },
      );

      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        'order-id-1',
        'user-id-1',
        75,
        undefined,
        PaymentMethod.PIX,
        '123.456.789-00',
        '1990-05-15',
        undefined,
      );
    });
  });

  // ─── getPayment ──────────────────────────────────────────────────
  describe('getPayment', () => {
    it('should return payment by ID', async () => {
      mockPaymentsService.getPayment.mockResolvedValue(mockPayment);

      const result = await controller.getPayment('payment-id-1');

      expect(paymentsService.getPayment).toHaveBeenCalledWith('payment-id-1');
      expect(result).toEqual(mockPayment);
    });
  });

  // ─── getUserPayments ─────────────────────────────────────────────
  describe('getUserPayments', () => {
    it('should return paginated payments with default pagination', async () => {
      const paginatedResult = {
        data: [mockPayment],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockPaymentsService.getUserPayments.mockResolvedValue(paginatedResult);

      const result = await controller.getUserPayments('user-id-1', 1, 10);

      expect(paymentsService.getUserPayments).toHaveBeenCalledWith('user-id-1', 1, 10);
      expect(result).toEqual(paginatedResult);
    });

    it('should return paginated payments with custom pagination', async () => {
      const paginatedResult = {
        data: [],
        meta: { total: 0, page: 2, limit: 5, totalPages: 0 },
      };
      mockPaymentsService.getUserPayments.mockResolvedValue(paginatedResult);

      const result = await controller.getUserPayments('user-id-1', 2, 5);

      expect(paymentsService.getUserPayments).toHaveBeenCalledWith('user-id-1', 2, 5);
      expect(result).toEqual(paginatedResult);
    });
  });

  // ─── refundPayment ───────────────────────────────────────────────
  describe('refundPayment', () => {
    it('should refund payment without amount', async () => {
      mockPaymentsService.refundPayment.mockResolvedValue({
        payment: { ...mockPayment, status: 'REFUNDED' },
        refundResult: { id: 'refund-1' },
      });

      const result = await controller.refundPayment('payment-id-1');

      expect(paymentsService.refundPayment).toHaveBeenCalledWith('payment-id-1', undefined);
      expect(result).toEqual({
        payment: expect.any(Object),
        refundResult: { id: 'refund-1' },
      });
    });

    it('should refund payment with partial amount', async () => {
      mockPaymentsService.refundPayment.mockResolvedValue({
        payment: { ...mockPayment, status: 'REFUNDED' },
        refundResult: { id: 'refund-2', value: 50 },
      });

      const result = await controller.refundPayment('payment-id-1', 50);

      expect(paymentsService.refundPayment).toHaveBeenCalledWith('payment-id-1', 50);
      expect(result.refundResult).toEqual({ id: 'refund-2', value: 50 });
    });
  });

  // ─── getPaymentByOrder ───────────────────────────────────────────
  describe('getPaymentByOrder', () => {
    it('should return payment by order ID', async () => {
      mockPaymentsService.getPaymentByOrderId.mockResolvedValue(mockPayment);

      const result = await controller.getPaymentByOrder('order-id-1');

      expect(paymentsService.getPaymentByOrderId).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when no payment exists for order', async () => {
      mockPaymentsService.getPaymentByOrderId.mockResolvedValue(null);

      await expect(controller.getPaymentByOrder('order-id-999')).rejects.toThrow(
        'Payment not found for this order',
      );
    });
  });

  // ─── webhook ─────────────────────────────────────────────────────
  describe('webhook', () => {
    it('should process Asaas webhook with valid signature', async () => {
      const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
      const webhookData = { event: 'PAYMENT_RECEIVED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(true);
      mockAsaasWebhookHandler.handleEvent.mockResolvedValue({ processed: true });

      const result = await controller.webhook('asaas', webhookData, rawBody, 'valid-signature');

      expect(mockAsaasWebhookHandler.verifySignature).toHaveBeenCalledWith(
        rawBody,
        'valid-signature',
      );
      expect(mockAsaasWebhookHandler.handleEvent).toHaveBeenCalledWith(webhookData);
      expect(result).toEqual({ status: 'ok' });
    });

    it('should throw UnauthorizedException when signature is invalid', async () => {
      const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
      const webhookData = { event: 'PAYMENT_RECEIVED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(false);

      await expect(
        controller.webhook('asaas', webhookData, rawBody, 'invalid-signature'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.webhook('asaas', webhookData, rawBody, 'invalid-signature'),
      ).rejects.toThrow('Invalid Asaas webhook signature.');
    });

    it('should throw when signature header is missing', async () => {
      const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
      const webhookData = { event: 'PAYMENT_RECEIVED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(false);

      await expect(controller.webhook('asaas', webhookData, rawBody, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return authorization status for WITHDRAWAL_REQUESTED events', async () => {
      const rawBody = Buffer.from('{"event":"WITHDRAWAL_REQUESTED"}');
      const webhookData = { event: 'WITHDRAWAL_REQUESTED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(true);
      mockAsaasWebhookHandler.handleEvent.mockResolvedValue({
        processed: true,
        authorizationStatus: 'APPROVED',
      });

      const result = await controller.webhook('asaas', webhookData, rawBody, 'valid-signature');

      expect(result).toEqual({ status: 'APPROVED' });
    });

    it('should return authorization status REJECTED for denied withdrawals', async () => {
      const rawBody = Buffer.from('{"event":"WITHDRAWAL_REQUESTED"}');
      const webhookData = { event: 'WITHDRAWAL_REQUESTED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(true);
      mockAsaasWebhookHandler.handleEvent.mockResolvedValue({
        processed: true,
        authorizationStatus: 'REJECTED',
      });

      const result = await controller.webhook('asaas', webhookData, rawBody, 'valid-signature');

      expect(result).toEqual({ status: 'REJECTED' });
    });

    it('should ignore non-asaas providers', async () => {
      const rawBody = Buffer.from('{}');
      const webhookData = { event: 'PAYMENT_RECEIVED' };

      const result = await controller.webhook('mercadopago', webhookData, rawBody, 'sig');

      expect(mockAsaasWebhookHandler.verifySignature).not.toHaveBeenCalled();
      expect(mockAsaasWebhookHandler.handleEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ignored', provider: 'mercadopago' });
    });

    it('should handle empty signature header', async () => {
      const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
      const webhookData = { event: 'PAYMENT_RECEIVED' };

      mockAsaasWebhookHandler.verifySignature.mockReturnValue(false);

      await expect(controller.webhook('asaas', webhookData, rawBody, '')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
