import { Test, TestingModule } from '@nestjs/testing';
import { AsaasWebhookHandler } from '../webhooks/asaas-webhook.handler';
import { PaymentsService } from '../payments.service';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

jest.mock('crypto', () => ({
  createHmac: jest.fn(),
  timingSafeEqual: jest.fn(),
}));

describe('AsaasWebhookHandler', () => {
  let handler: AsaasWebhookHandler;
  let _paymentsService: PaymentsService;

  const mockPaymentsService = {
    approvePaymentByProviderTxId: jest.fn(),
    refundPaymentByProviderTxId: jest.fn(),
    rejectPaymentByProviderTxId: jest.fn(),
    verifyPaymentWithProvider: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const WEBHOOK_SECRET = 'test-webhook-secret';

  beforeEach(async () => {
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'ASAAS_WEBHOOK_SECRET') return WEBHOOK_SECRET;
      return defaultValue;
    });

    // Reset crypto mocks to avoid bleeding between tests
    (createHmac as jest.Mock).mockReset();
    (timingSafeEqual as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasWebhookHandler,
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    handler = module.get<AsaasWebhookHandler>(AsaasWebhookHandler);
    paymentsService = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  // ─── verifySignature ─────────────────────────────────────────────
  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED","payment":{"id":"pay-1"}}';
      // Digest returns raw bytes; signature is hex representation of those bytes
      const expectedDigest = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(expectedDigest),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);
      (timingSafeEqual as jest.Mock).mockReturnValue(true);

      const result = handler.verifySignature(rawBody, 'aabbccdd');

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('expected-digest')),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);
      (timingSafeEqual as jest.Mock).mockReturnValue(false);

      const result = handler.verifySignature(rawBody, 'invalid-signature');

      expect(result).toBe(false);
    });

    it('should return false when signature is missing', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';

      const result = handler.verifySignature(rawBody, '');

      expect(result).toBe(false);
    });

    it('should return false when webhook secret is not set', () => {
      mockConfigService.get.mockReturnValue('');

      const module2 = Test.createTestingModule({
        providers: [
          AsaasWebhookHandler,
          { provide: PaymentsService, useValue: mockPaymentsService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      });

      // Re-compile to pick up the empty secret
      return module2.compile().then(m => {
        const h = m.get<AsaasWebhookHandler>(AsaasWebhookHandler);
        const result = h.verifySignature('body', 'some-signature');
        expect(result).toBe(false);
      });
    });

    it('should handle Buffer input', () => {
      const rawBody = Buffer.from('{"event":"PAYMENT_RECEIVED"}');
      const expectedDigest = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(expectedDigest),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);
      (timingSafeEqual as jest.Mock).mockReturnValue(true);

      const result = handler.verifySignature(rawBody, 'aabbccdd');

      expect(result).toBe(true);
      expect(mockHmac.update).toHaveBeenCalledWith(rawBody);
    });

    it('should return false when signature and expected have different lengths', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('short')),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);

      const result = handler.verifySignature(rawBody, 'a-very-long-signature-hex');

      expect(result).toBe(false);
      expect(timingSafeEqual).not.toHaveBeenCalled();
    });

    it('should return false when crypto throws', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockImplementation(() => {
          throw new Error('Crypto error');
        }),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);

      const result = handler.verifySignature(rawBody, 'some-signature');

      expect(result).toBe(false);
    });

    it('should normalize signature to lowercase before comparison', () => {
      const rawBody = '{"event":"PAYMENT_RECEIVED"}';
      const expectedDigest = Buffer.from([0xab, 0xcd, 0xef]);

      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(expectedDigest),
      };
      (createHmac as jest.Mock).mockReturnValue(mockHmac);
      (timingSafeEqual as jest.Mock).mockReturnValue(true);

      const result = handler.verifySignature(rawBody, 'ABCDEF');

      expect(result).toBe(true);
    });
  });

  // ─── handleEvent ─────────────────────────────────────────────────
  describe('handleEvent', () => {
    it('should handle PAYMENT_RECEIVED event', async () => {
      const event = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay-1', status: 'RECEIVED' },
      };

      mockPaymentsService.approvePaymentByProviderTxId.mockResolvedValue({});

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.approvePaymentByProviderTxId).toHaveBeenCalledWith('pay-1', {
        id: 'pay-1',
        status: 'RECEIVED',
      });
      expect(result).toEqual({ processed: true });
    });

    it('should handle PAYMENT_CONFIRMED event', async () => {
      const event = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay-2', status: 'CONFIRMED' },
      };

      mockPaymentsService.approvePaymentByProviderTxId.mockResolvedValue({});

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.approvePaymentByProviderTxId).toHaveBeenCalledWith('pay-2', {
        id: 'pay-2',
        status: 'CONFIRMED',
      });
      expect(result).toEqual({ processed: true });
    });

    it('should handle PAYMENT_REFUNDED event', async () => {
      const event = {
        event: 'PAYMENT_REFUNDED',
        payment: { id: 'pay-3', status: 'REFUNDED' },
      };

      mockPaymentsService.refundPaymentByProviderTxId.mockResolvedValue({});

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.refundPaymentByProviderTxId).toHaveBeenCalledWith('pay-3');
      expect(result).toEqual({ processed: true });
    });

    it('should handle PAYMENT_REFUND_REQUESTED event', async () => {
      const event = {
        event: 'PAYMENT_REFUND_REQUESTED',
        payment: { id: 'pay-4' },
      };

      mockPaymentsService.refundPaymentByProviderTxId.mockResolvedValue({});

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.refundPaymentByProviderTxId).toHaveBeenCalledWith('pay-4');
      expect(result).toEqual({ processed: true });
    });

    it('should handle PAYMENT_OVERDUE event', async () => {
      const event = {
        event: 'PAYMENT_OVERDUE',
        payment: { id: 'pay-5' },
      };

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.approvePaymentByProviderTxId).not.toHaveBeenCalled();
      expect(result).toEqual({ processed: true });
    });

    it('should handle PAYMENT_CANCELLED event', async () => {
      const event = {
        event: 'PAYMENT_CANCELLED',
        payment: { id: 'pay-6' },
      };

      mockPaymentsService.rejectPaymentByProviderTxId.mockResolvedValue({});

      const result = await handler.handleEvent(event);

      expect(mockPaymentsService.rejectPaymentByProviderTxId).toHaveBeenCalledWith(
        'pay-6',
        'cancelled',
      );
      expect(result).toEqual({ processed: true });
    });

    it('should handle WITHDRAWAL_REQUESTED event with APPROVED status', async () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-1', value: 100, type: 'PIX_REFUND' },
      };

      const result = await handler.handleEvent(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should handle PAYMENT_CHECKOUT_REFUND_REQUEST event with APPROVED status', async () => {
      const event = {
        event: 'PAYMENT_CHECKOUT_REFUND_REQUEST',
        payment: { id: 'pay-7' },
      };

      const result = await handler.handleEvent(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should return processed:false for unknown event', async () => {
      const event = {
        event: 'UNKNOWN_EVENT_TYPE',
      };

      const result = await handler.handleEvent(event);

      expect(result).toEqual({ processed: false });
    });

    it('should return processed:false for invalid payload', async () => {
      const result = await handler.handleEvent({} as any);

      expect(result).toEqual({ processed: false });
    });

    it('should return processed:false when event is null', async () => {
      const result = await handler.handleEvent(null as any);

      expect(result).toEqual({ processed: false });
    });

    it('should return REJECTED authorizationStatus when error occurs during processing', async () => {
      const event = {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay-err' },
      };

      mockPaymentsService.approvePaymentByProviderTxId.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleEvent(event);

      expect(result).toEqual({ processed: false, authorizationStatus: 'REJECTED' });
    });
  });

  // ─── handlePaymentReceived ───────────────────────────────────────
  describe('handlePaymentReceived', () => {
    it('should approve payment with payment ID', async () => {
      mockPaymentsService.approvePaymentByProviderTxId.mockResolvedValue({});

      await (handler as any).handlePaymentReceived({ id: 'pay-123' });

      expect(mockPaymentsService.approvePaymentByProviderTxId).toHaveBeenCalledWith('pay-123', {
        id: 'pay-123',
      });
    });

    it('should throw when payment ID is missing', async () => {
      await expect((handler as any).handlePaymentReceived({})).rejects.toThrow(
        'Payment ID missing',
      );
    });

    it('should throw when payment is null', async () => {
      await expect((handler as any).handlePaymentReceived(null)).rejects.toThrow(
        'Payment ID missing',
      );
    });

    it('should throw when payment is undefined', async () => {
      await expect((handler as any).handlePaymentReceived(undefined)).rejects.toThrow(
        'Payment ID missing',
      );
    });

    it('should convert payment ID to string', async () => {
      mockPaymentsService.approvePaymentByProviderTxId.mockResolvedValue({});

      await (handler as any).handlePaymentReceived({ id: 12345 });

      expect(mockPaymentsService.approvePaymentByProviderTxId).toHaveBeenCalledWith('12345', {
        id: 12345,
      });
    });
  });

  // ─── handlePaymentRefunded ───────────────────────────────────────
  describe('handlePaymentRefunded', () => {
    it('should refund payment with payment ID', async () => {
      mockPaymentsService.refundPaymentByProviderTxId.mockResolvedValue({});

      await (handler as any).handlePaymentRefunded({ id: 'pay-refund' });

      expect(mockPaymentsService.refundPaymentByProviderTxId).toHaveBeenCalledWith('pay-refund');
    });

    it('should return early when payment ID is missing', async () => {
      await (handler as any).handlePaymentRefunded({});

      expect(mockPaymentsService.refundPaymentByProviderTxId).not.toHaveBeenCalled();
    });

    it('should return early when payment is null', async () => {
      await (handler as any).handlePaymentRefunded(null);

      expect(mockPaymentsService.refundPaymentByProviderTxId).not.toHaveBeenCalled();
    });

    it('should return early when payment is undefined', async () => {
      await (handler as any).handlePaymentRefunded(undefined);

      expect(mockPaymentsService.refundPaymentByProviderTxId).not.toHaveBeenCalled();
    });
  });

  // ─── handlePaymentCancelled ──────────────────────────────────────
  describe('handlePaymentCancelled', () => {
    it('should reject payment with payment ID', async () => {
      mockPaymentsService.rejectPaymentByProviderTxId.mockResolvedValue({});

      await (handler as any).handlePaymentCancelled({ id: 'pay-cancel' });

      expect(mockPaymentsService.rejectPaymentByProviderTxId).toHaveBeenCalledWith(
        'pay-cancel',
        'cancelled',
      );
    });

    it('should return early when payment ID is missing', async () => {
      await (handler as any).handlePaymentCancelled({});

      expect(mockPaymentsService.rejectPaymentByProviderTxId).not.toHaveBeenCalled();
    });

    it('should return early when payment is null', async () => {
      await (handler as any).handlePaymentCancelled(null);

      expect(mockPaymentsService.rejectPaymentByProviderTxId).not.toHaveBeenCalled();
    });

    it('should return early when payment is undefined', async () => {
      await (handler as any).handlePaymentCancelled(undefined);

      expect(mockPaymentsService.rejectPaymentByProviderTxId).not.toHaveBeenCalled();
    });
  });

  // ─── handleWithdrawalAuthorization ───────────────────────────────
  describe('handleWithdrawalAuthorization', () => {
    it('should APPROVE PIX refund withdrawal', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-pix', value: 200, type: 'PIX_REFUND' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should APPROVE normal withdrawal', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-normal', value: 500, type: 'TRANSFER' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should APPROVE when event is PAYMENT_CHECKOUT_REFUND_REQUEST', () => {
      const event = {
        event: 'PAYMENT_CHECKOUT_REFUND_REQUEST',
        payment: { id: 'pay-refund-req', value: 100 },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should REJECT when withdrawal data is missing', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'REJECTED' });
    });

    it('should use transfer as fallback when withdrawal is missing', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        transfer: { id: 'transfer-1', value: 300, type: 'BANK_TRANSFER' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should use payment as fallback when withdrawal and transfer are missing', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        payment: { id: 'pay-fallback', value: 150, type: 'CHARGEBACK' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should APPROVE when type includes ESTORNO', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-estorno', value: 100, type: 'ESTORNO_PIX' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should APPROVE when type includes REFUND', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-refund', value: 100, type: 'REFUND_PROCESS' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should APPROVE when type includes CHARGEBACK', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-cb', value: 100, type: 'CHARGEBACK_DISPUTE' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });

    it('should handle withdrawal with default values when fields missing', () => {
      const event = {
        event: 'WITHDRAWAL_REQUESTED',
        withdrawal: { id: 'wd-minimal' },
      };

      const result = (handler as any).handleWithdrawalAuthorization(event);

      expect(result).toEqual({ processed: true, authorizationStatus: 'APPROVED' });
    });
  });
});
