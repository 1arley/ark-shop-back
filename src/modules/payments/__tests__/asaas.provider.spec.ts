import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AsaasProvider } from '../providers/asaas.provider';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AsaasProvider', () => {
  let provider: AsaasProvider;

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const mockPrisma = {
    seller: {
      findFirst: jest.fn(),
    },
  };

  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'ASAAS_API_KEY') return 'test-api-key';
      if (key === 'ASAAS_SANDBOX') return 'true';
      return defaultValue;
    });

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasProvider,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    provider = module.get<AsaasProvider>(AsaasProvider);

    jest.clearAllMocks();
  });

  // ─── createSubAccount ────────────────────────────────────────────
  describe('createSubAccount', () => {
    it('should create a subaccount successfully', async () => {
      const responseData = {
        id: 'sub-123',
        walletId: 'wallet-456',
        accountNumber: '123456',
      };
      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await provider.createSubAccount({
        name: 'Test Seller',
        email: 'seller@test.com',
        cpfCnpj: '12345678900',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/accounts', {
        name: 'Test Seller',
        email: 'seller@test.com',
        cpfCnpj: '12345678900',
      });
      expect(result).toEqual({
        id: 'sub-123',
        walletId: 'wallet-456',
        accountNumber: '123456',
      });
    });

    it('should create subaccount with full data', async () => {
      const responseData = {
        id: 'sub-789',
        walletId: 'wallet-789',
        accountNumber: '654321',
      };
      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await provider.createSubAccount({
        name: 'Full Seller',
        email: 'full@test.com',
        cpfCnpj: '12345678900',
        companyType: 'INDIVIDUAL',
        phone: '11999999999',
        mobilePhone: '11988888888',
        address: 'Rua Teste',
        addressNumber: '100',
        complement: 'Apto 1',
        province: 'Centro',
        postalCode: '01000-000',
        bankAccount: {
          bank: '001',
          account: '12345',
          accountDigit: '6',
          agency: '1234',
          agencyDigit: '5',
          type: 'CONTA_CORRENTE',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/accounts',
        expect.objectContaining({
          name: 'Full Seller',
          bankAccount: expect.objectContaining({
            bank: '001',
            type: 'CONTA_CORRENTE',
          }),
        }),
      );
      expect(result.id).toBe('sub-789');
    });

    it('should throw BadRequestException on API error', async () => {
      const apiError = {
        response: {
          data: {
            errors: [{ description: 'Email already exists', code: 'INVALID_EMAIL' }],
          },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      await expect(
        provider.createSubAccount({
          name: 'Test',
          email: 'duplicate@test.com',
          cpfCnpj: '12345678900',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        provider.createSubAccount({
          name: 'Test',
          email: 'duplicate@test.com',
          cpfCnpj: '12345678900',
        }),
      ).rejects.toThrow('Failed to create Asaas account: Email already exists');
    });

    it('should throw BadRequestException with generic message when no API error details', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network Error'));

      await expect(
        provider.createSubAccount({
          name: 'Test',
          email: 'test@test.com',
          cpfCnpj: '12345678900',
        }),
      ).rejects.toThrow('Failed to create Asaas account: Network Error');
    });
  });

  // ─── createPayment ───────────────────────────────────────────────
  describe('createPayment', () => {
    it('should create PIX payment with split', async () => {
      const responseData = {
        id: 'pay-123',
        status: 'PENDING',
        value: 100,
        netValue: 90,
        pixQrCode: 'qr-base64',
        pixCopyPaste: 'pix-copy-paste',
        invoiceUrl: 'https://asaas.com/pay/pay-123',
        externalReference: 'order-123',
        split: [{ walletId: 'wallet-1', percentualValue: 90 }],
      };
      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await provider.createPayment({
        amount: 100,
        description: 'Pedido #order-123',
        customer: 'cust-123',
        externalReference: 'order-123',
        sellerWalletId: 'wallet-1',
        commissionPercent: 10,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({
          customer: 'cust-123',
          billingType: 'PIX',
          value: 100,
          split: [{ walletId: 'wallet-1', percentualValue: 90 }],
        }),
      );
      expect(result).toEqual({
        id: 'pay-123',
        status: 'PENDING',
        value: 100,
        netValue: 90,
        pixQrCode: 'data:image/png;base64,qr-base64',
        pixCopyPaste: 'pix-copy-paste',
        invoiceUrl: 'https://asaas.com/pay/pay-123',
        externalReference: 'order-123',
        split: [{ walletId: 'wallet-1', percentualValue: 90 }],
      });
    });

    it('should create PIX payment without split', async () => {
      const responseData = {
        id: 'pay-456',
        status: 'PENDING',
        value: 50,
        netValue: 50,
        pixQrCode: 'qr-data',
        pixCopyPaste: 'pix-code',
      };
      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await provider.createPayment({
        amount: 50,
        description: 'Pedido #test',
        customer: 'cust-456',
      });

      // When no sellerWalletId, split is not included in payload
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payments',
        expect.not.objectContaining({
          split: expect.anything(),
        }),
      );
      expect(result.id).toBe('pay-456');
      expect(result.split).toEqual([]);
    });

    it('should use default commission of 10% when not provided', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-def',
          status: 'PENDING',
          value: 100,
          netValue: 90,
          pixQrCode: 'qr',
          pixCopyPaste: 'code',
        },
      });

      await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
        sellerWalletId: 'wallet-1',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({
          split: [{ walletId: 'wallet-1', percentualValue: 90 }],
        }),
      );
    });

    it('should fetch QR code separately when not in create response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-no-qr',
          status: 'PENDING',
          value: 100,
          netValue: 100,
          pixQrCode: null,
          pixCopyPaste: null,
        },
      });
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          payload: 'pix-copy-paste-fetched',
          encodedImage: 'qr-image-fetched',
          expirationDate: '2026-01-01',
        },
      });

      const result = await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments/pay-no-qr/pixQrCode');
      expect(result.pixCopyPaste).toBe('pix-copy-paste-fetched');
      expect(result.pixQrCode).toBe('data:image/png;base64,qr-image-fetched');
    });

    it('should handle QR code fetch failure gracefully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-no-qr-2',
          status: 'PENDING',
          value: 100,
          netValue: 100,
          pixQrCode: null,
          pixCopyPaste: null,
        },
      });
      mockAxiosInstance.get.mockRejectedValue(new Error('QR fetch failed'));

      const result = await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
      });

      expect(result.pixQrCode).toBeNull();
      expect(result.pixCopyPaste).toBeNull();
    });

    it('should handle QR code already starting with data:', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-data',
          status: 'PENDING',
          value: 100,
          netValue: 100,
          pixQrCode: 'data:image/png;base64,already-data',
          pixCopyPaste: 'code',
        },
      });

      const result = await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
      });

      expect(result.pixQrCode).toBe('data:image/png;base64,already-data');
    });

    it('should handle QR code starting with http', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-http',
          status: 'PENDING',
          value: 100,
          netValue: 100,
          pixQrCode: 'https://asaas.com/qr/image.png',
          pixCopyPaste: 'code',
        },
      });

      const result = await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
      });

      expect(result.pixQrCode).toBe('https://asaas.com/qr/image.png');
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Invalid customer', code: 'INVALID_CUSTOMER' }],
          },
        },
      });

      await expect(
        provider.createPayment({
          amount: 100,
          description: 'Test',
          customer: 'invalid-cust',
        }),
      ).rejects.toThrow('Failed to create Asaas payment: Invalid customer');
    });
  });

  // ─── getPixQrCode ────────────────────────────────────────────────
  describe('getPixQrCode', () => {
    it('should fetch PIX QR code successfully', async () => {
      const qrData = {
        payload: '00020126580014br.gov.bcb.pix...',
        encodedImage: 'base64-image',
        expirationDate: '2026-01-01T00:15:00Z',
      };
      mockAxiosInstance.get.mockResolvedValue({ data: qrData });

      const result = await provider.getPixQrCode('pay-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments/pay-123/pixQrCode');
      expect(result).toEqual(qrData);
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Payment not found', code: 'NOT_FOUND' }],
          },
        },
      });

      await expect(provider.getPixQrCode('nonexistent')).rejects.toThrow(
        'Failed to fetch PIX QR code: Payment not found',
      );
    });

    it('should throw with generic message when no API error details', async () => {
      mockAxiosInstance.get.mockRejectedValue({ message: 'Timeout' });

      await expect(provider.getPixQrCode('pay-123')).rejects.toThrow(
        'Failed to fetch PIX QR code: Timeout',
      );
    });
  });

  // ─── verifyPayment ───────────────────────────────────────────────
  describe('verifyPayment', () => {
    it('should map RECEIVED status to approved', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-1', status: 'RECEIVED', value: 100 },
      });

      const result = await provider.verifyPayment('pay-1');

      expect(result.status).toBe('approved');
      expect(result.amount).toBe(100);
      expect(result.providerData).toEqual({ id: 'pay-1', status: 'RECEIVED', value: 100 });
    });

    it('should map CONFIRMED status to approved', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-2', status: 'CONFIRMED', value: 200 },
      });

      const result = await provider.verifyPayment('pay-2');

      expect(result.status).toBe('approved');
    });

    it('should map RECEIVED_IN_CASH status to approved', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-3', status: 'RECEIVED_IN_CASH', value: 150 },
      });

      const result = await provider.verifyPayment('pay-3');

      expect(result.status).toBe('approved');
    });

    it('should map PENDING status to pending', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-4', status: 'PENDING', value: 50 },
      });

      const result = await provider.verifyPayment('pay-4');

      expect(result.status).toBe('pending');
    });

    it('should map OVERDUE status to expired', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-5', status: 'OVERDUE', value: 50 },
      });

      const result = await provider.verifyPayment('pay-5');

      expect(result.status).toBe('expired');
    });

    it('should map REFUNDED status to refunded', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-6', status: 'REFUNDED', value: 50 },
      });

      const result = await provider.verifyPayment('pay-6');

      expect(result.status).toBe('refunded');
    });

    it('should map PARTIALLY_REFUNDED status to refunded', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-7', status: 'PARTIALLY_REFUNDED', value: 50 },
      });

      const result = await provider.verifyPayment('pay-7');

      expect(result.status).toBe('refunded');
    });

    it('should map REFUND_REQUESTED status to pending', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-8', status: 'REFUND_REQUESTED', value: 50 },
      });

      const result = await provider.verifyPayment('pay-8');

      expect(result.status).toBe('pending');
    });

    it('should map CHARGEBACK_REQUESTED status to pending', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-9', status: 'CHARGEBACK_REQUESTED', value: 50 },
      });

      const result = await provider.verifyPayment('pay-9');

      expect(result.status).toBe('pending');
    });

    it('should map CHARGEBACK_DISPUTE status to pending', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-10', status: 'CHARGEBACK_DISPUTE', value: 50 },
      });

      const result = await provider.verifyPayment('pay-10');

      expect(result.status).toBe('pending');
    });

    it('should map AWAITING_CHARGEBACK_REVERSAL status to pending', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-11', status: 'AWAITING_CHARGEBACK_REVERSAL', value: 50 },
      });

      const result = await provider.verifyPayment('pay-11');

      expect(result.status).toBe('pending');
    });

    it('should map CANCELLED status to cancelled', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-12', status: 'CANCELLED', value: 50 },
      });

      const result = await provider.verifyPayment('pay-12');

      expect(result.status).toBe('cancelled');
    });

    it('should lowercase unknown status', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'pay-13', status: 'UNKNOWN_STATUS', value: 50 },
      });

      const result = await provider.verifyPayment('pay-13');

      expect(result.status).toBe('unknown_status');
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Payment not found', code: 'NOT_FOUND' }],
          },
        },
      });

      await expect(provider.verifyPayment('nonexistent')).rejects.toThrow(
        'Failed to verify payment: Failed to fetch payment: Payment not found',
      );
    });
  });

  // ─── getPayment ──────────────────────────────────────────────────
  describe('getPayment', () => {
    it('should return payment data', async () => {
      const paymentData = {
        id: 'pay-1',
        status: 'PENDING',
        value: 100,
        netValue: 90,
        billingType: 'PIX',
      };
      mockAxiosInstance.get.mockResolvedValue({ data: paymentData });

      const result = await provider.getPayment('pay-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments/pay-1');
      expect(result).toEqual(paymentData);
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Not found', code: 'NOT_FOUND' }],
          },
        },
      });

      await expect(provider.getPayment('nonexistent')).rejects.toThrow(
        'Failed to fetch payment: Not found',
      );
    });
  });

  // ─── createCustomer ──────────────────────────────────────────────
  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'cust-123' } });

      const result = await provider.createCustomer({
        name: 'John Doe',
        email: 'john@email.com',
        cpfCnpj: '123.456.789-00',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/customers', {
        name: 'John Doe',
        email: 'john@email.com',
        cpfCnpj: '123.456.789-00',
      });
      expect(result).toBe('cust-123');
    });

    it('should create customer with optional phone', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'cust-456' } });

      const result = await provider.createCustomer({
        name: 'Jane Doe',
        email: 'jane@email.com',
        phone: '11999999999',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/customers', {
        name: 'Jane Doe',
        email: 'jane@email.com',
        phone: '11999999999',
      });
      expect(result).toBe('cust-456');
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Invalid email', code: 'INVALID_EMAIL' }],
          },
        },
      });

      await expect(
        provider.createCustomer({
          name: 'Test',
          email: 'invalid-email',
        }),
      ).rejects.toThrow('Failed to create Asaas customer: Invalid email');
    });
  });

  // ─── refundPayment ───────────────────────────────────────────────
  describe('refundPayment', () => {
    it('should refund payment with amount', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'refund-1', value: 50 } });

      const result = await provider.refundPayment('pay-1', 50);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/payments/pay-1/refund', {
        value: 50,
      });
      expect(result).toEqual({ id: 'refund-1', value: 50 });
    });

    it('should refund payment without amount (full refund)', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'refund-2', value: 100 } });

      const result = await provider.refundPayment('pay-2');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/payments/pay-2/refund', {});
      expect(result).toEqual({ id: 'refund-2', value: 100 });
    });

    it('should throw BadRequestException on API error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: {
            errors: [{ description: 'Payment cannot be refunded', code: 'INVALID_STATE' }],
          },
        },
      });

      await expect(provider.refundPayment('pay-3', 50)).rejects.toThrow(
        'Refund failed: Payment cannot be refunded',
      );
    });
  });

  // ─── getSellerWalletForOrder ─────────────────────────────────────
  describe('getSellerWalletForOrder', () => {
    it('should return wallet info for active seller', async () => {
      mockPrisma.seller.findFirst.mockResolvedValue({
        id: 'seller-1',
        asaasWalletId: 'wallet-123',
        commission: { toNumber: () => 10 },
        isActive: true,
        createdAt: new Date(),
      });

      const result = await provider.getSellerWalletForOrder('order-1');

      expect(mockPrisma.seller.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        walletId: 'wallet-123',
        commission: 10,
      });
    });

    it('should return null when no active seller exists', async () => {
      mockPrisma.seller.findFirst.mockResolvedValue(null);

      const result = await provider.getSellerWalletForOrder('order-1');

      expect(result).toBeNull();
    });

    it('should return null when seller has no walletId', async () => {
      mockPrisma.seller.findFirst.mockResolvedValue({
        id: 'seller-2',
        asaasWalletId: null,
        commission: { toNumber: () => 15 },
        isActive: true,
        createdAt: new Date(),
      });

      const result = await provider.getSellerWalletForOrder('order-1');

      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      mockPrisma.seller.findFirst.mockRejectedValue(new Error('Database connection failed'));

      await expect(provider.getSellerWalletForOrder('order-1')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  // ─── getDueDate ──────────────────────────────────────────────────
  describe('getDueDate', () => {
    it('should return date 3 days from now', async () => {
      const fixedDate = Date.parse('2026-05-17T00:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fixedDate);

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'pay-date',
          status: 'PENDING',
          value: 100,
          netValue: 100,
          pixQrCode: 'qr',
          pixCopyPaste: 'code',
        },
      });

      await provider.createPayment({
        amount: 100,
        description: 'Test',
        customer: 'cust-1',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({
          dueDate: '2026-05-20',
        }),
      );

      jest.useRealTimers();
    });
  });
});
