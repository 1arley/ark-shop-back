import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentProviderFactory } from '../payment-provider.factory';
import { AsaasProvider } from '../providers/asaas.provider';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProvider, PaymentMethod } from '@prisma/client';

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;

  const mockAsaasProvider = {
    createPayment: jest.fn(),
    verifyPayment: jest.fn(),
    refundPayment: jest.fn(),
    createCustomer: jest.fn(),
    getSellerWalletForOrder: jest.fn(),
    getPixQrCode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const mockPrismaService = {
    order: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-123' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ asaasCustomerId: null }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderFactory,
        { provide: AsaasProvider, useValue: mockAsaasProvider },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    factory = module.get<PaymentProviderFactory>(PaymentProviderFactory);

    jest.clearAllMocks();
  });

  // ─── getProvider ─────────────────────────────────────────────────
  describe('getProvider', () => {
    it('should return ASAAS provider when registered', () => {
      const provider = factory.getProvider(PaymentProvider.ASAAS);

      expect(provider).toBeDefined();
      expect(provider.name).toBe(PaymentProvider.ASAAS);
      expect(provider.createPaymentIntent).toBeDefined();
      expect(provider.verifyPayment).toBeDefined();
      expect(provider.refundPayment).toBeDefined();
    });

    it('should throw BadRequestException for unknown provider', () => {
      expect(() => factory.getProvider('MERCADO_PAGO')).toThrow(BadRequestException);

      expect(() => factory.getProvider('MERCADO_PAGO')).toThrow(
        'Payment provider MERCADO_PAGO not available',
      );
    });

    it('should throw BadRequestException for null provider', () => {
      expect(() => factory.getProvider(null as unknown as PaymentProvider)).toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getDefaultProvider ──────────────────────────────────────────
  describe('getDefaultProvider', () => {
    it('should return ASAAS from env var', () => {
      mockConfigService.get.mockReturnValue('ASAAS');

      const result = factory.getDefaultProvider();

      expect(result).toBe(PaymentProvider.ASAAS);
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_DEFAULT_PROVIDER', 'ASAAS');
    });

    it('should return ASAAS as default when env var not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = factory.getDefaultProvider();

      expect(result).toBe(PaymentProvider.ASAAS);
    });

    it('should return ASAAS when env var has invalid value', () => {
      mockConfigService.get.mockReturnValue('INVALID_PROVIDER');

      const result = factory.getDefaultProvider();

      expect(result).toBe(PaymentProvider.ASAAS);
    });

    it('should return configured provider when valid', () => {
      mockConfigService.get.mockReturnValue('ASAAS');

      const result = factory.getDefaultProvider();

      expect(result).toBe(PaymentProvider.ASAAS);
    });
  });

  // ─── getRegisteredProviders ──────────────────────────────────────
  describe('getRegisteredProviders', () => {
    it('should return array containing ASAAS', () => {
      const providers = factory.getRegisteredProviders();

      expect(providers).toContain(PaymentProvider.ASAAS);
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should return exactly one provider', () => {
      const providers = factory.getRegisteredProviders();

      expect(providers.length).toBe(1);
    });
  });

  // ─── createAsaasIntent ───────────────────────────────────────────
  describe('createAsaasIntent (via provider)', () => {
    it('should create payment intent with seller wallet', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue({
        walletId: 'wallet-123',
        commission: 10,
      });
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-123');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-123',
        value: 100,
        status: 'PENDING',
        pixQrCode: 'qr-base64',
        pixCopyPaste: 'pix-copy-paste',
        split: [{ walletId: 'wallet-123', percentualValue: 90 }],
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      const result = await provider.createPaymentIntent({
        amount: 100,
        currency: 'BRL',
        orderId: 'order-id-12345678',
        method: PaymentMethod.PIX,
        payerEmail: 'test@test.com',
        payerName: 'Test User',
        payerCpf: '123.456.789-00',
      });

      expect(mockAsaasProvider.getSellerWalletForOrder).toHaveBeenCalledWith('order-id-12345678');
      expect(mockAsaasProvider.createCustomer).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@test.com',
        cpfCnpj: '123.456.789-00',
      });
      expect(mockAsaasProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          customer: 'cust-123',
          sellerWalletId: 'wallet-123',
          commissionPercent: 10,
        }),
      );
      expect(result).toEqual({
        id: 'pay-123',
        amount: 100,
        currency: 'BRL',
        status: 'PENDING',
        providerData: expect.objectContaining({
          id: 'pay-123',
          pix_qr_code: 'qr-base64',
          pix_copy_paste: 'pix-copy-paste',
          asaasPaymentId: 'pay-123',
          split: [{ walletId: 'wallet-123', percentualValue: 90 }],
        }),
      });
    });

    it('should create payment intent without seller wallet', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue(null);
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-456');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-456',
        value: 50,
        status: 'PENDING',
        pixQrCode: 'qr-base64',
        pixCopyPaste: 'pix-copy-paste',
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      const result = await provider.createPaymentIntent({
        amount: 50,
        currency: 'BRL',
        orderId: 'order-id-87654321',
        method: PaymentMethod.PIX,
      });

      expect(mockAsaasProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerWalletId: undefined,
          commissionPercent: 10,
        }),
      );
      expect(result.id).toBe('pay-456');
    });

    it('should use default payer info when not provided', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue(null);
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-789');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-789',
        value: 30,
        status: 'PENDING',
        pixQrCode: null,
        pixCopyPaste: null,
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      await provider.createPaymentIntent({
        amount: 30,
        currency: 'BRL',
        orderId: 'order-id-11111111',
        method: PaymentMethod.PIX,
      });

      expect(mockAsaasProvider.createCustomer).toHaveBeenCalledWith({
        name: 'Cliente',
        email: 'cliente@email.com',
        cpfCnpj: undefined,
      });
    });

    it('should slice orderId to 8 chars for description', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue(null);
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-1');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-1',
        value: 10,
        status: 'PENDING',
        pixQrCode: null,
        pixCopyPaste: null,
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      await provider.createPaymentIntent({
        amount: 10,
        currency: 'BRL',
        orderId: 'order-12345678-extra',
        method: PaymentMethod.PIX,
      });

      expect(mockAsaasProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Pedido #order-12',
        }),
      );
    });
  });

  // ─── verifyAsaasPayment ──────────────────────────────────────────
  describe('verifyAsaasPayment (via provider)', () => {
    it('should delegate to asaasProvider', async () => {
      mockAsaasProvider.verifyPayment.mockResolvedValue({
        status: 'approved',
        amount: 100,
        providerData: { id: 'pay-1' },
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      const result = await provider.verifyPayment('pay-1');

      expect(mockAsaasProvider.verifyPayment).toHaveBeenCalledWith('pay-1');
      expect(result).toEqual({
        status: 'approved',
        amount: 100,
        providerData: { id: 'pay-1' },
      });
    });
  });

  // ─── refundAsaasPayment ──────────────────────────────────────────
  describe('refundAsaasPayment (via provider)', () => {
    it('should delegate to asaasProvider with amount', async () => {
      mockAsaasProvider.refundPayment.mockResolvedValue({ id: 'refund-1', value: 50 });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      const result = await provider.refundPayment('pay-1', 50);

      expect(mockAsaasProvider.refundPayment).toHaveBeenCalledWith('pay-1', 50);
      expect(result).toEqual({ id: 'refund-1', value: 50 });
    });

    it('should delegate to asaasProvider without amount', async () => {
      mockAsaasProvider.refundPayment.mockResolvedValue({ id: 'refund-2' });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      const result = await provider.refundPayment('pay-1');

      expect(mockAsaasProvider.refundPayment).toHaveBeenCalledWith('pay-1', undefined);
      expect(result).toEqual({ id: 'refund-2' });
    });
  });

  // ─── ensureCustomer ──────────────────────────────────────────────
  describe('ensureCustomer (via createAsaasIntent)', () => {
    it('should create customer with full payer info', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue(null);
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-full');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-full',
        value: 100,
        status: 'PENDING',
        pixQrCode: null,
        pixCopyPaste: null,
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      await provider.createPaymentIntent({
        amount: 100,
        currency: 'BRL',
        orderId: 'order-id-1',
        method: PaymentMethod.PIX,
        payerEmail: 'john@email.com',
        payerName: 'John Doe',
        payerCpf: '111.222.333-44',
      });

      expect(mockAsaasProvider.createCustomer).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@email.com',
        cpfCnpj: '111.222.333-44',
      });
    });

    it('should use defaults when payer info is missing', async () => {
      mockAsaasProvider.getSellerWalletForOrder.mockResolvedValue(null);
      mockAsaasProvider.createCustomer.mockResolvedValue('cust-default');
      mockAsaasProvider.createPayment.mockResolvedValue({
        id: 'pay-default',
        value: 100,
        status: 'PENDING',
        pixQrCode: null,
        pixCopyPaste: null,
      });

      const provider = factory.getProvider(PaymentProvider.ASAAS);
      await provider.createPaymentIntent({
        amount: 100,
        currency: 'BRL',
        orderId: 'order-id-1',
        method: PaymentMethod.PIX,
      });

      expect(mockAsaasProvider.createCustomer).toHaveBeenCalledWith({
        name: 'Cliente',
        email: 'cliente@email.com',
        cpfCnpj: undefined,
      });
    });
  });
});
