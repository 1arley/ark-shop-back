import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AsaasProvider } from '@/modules/payments/providers/asaas.provider';

/**
 * Mock AsaasProvider for testing — returns fake data
 * without making real HTTP calls to the Asaas API.
 */
const mockAsaasProvider = {
  createCustomer: async () => 'mock-customer-id',
  createPayment: async () => ({
    id: 'mock-payment-id',
    status: 'CONFIRMED',
    value: 100,
    netValue: 97,
    pixQrCode: 'data:image/png;base64,mock-qr-code',
    pixCopyPaste: 'mock-pix-copy-paste',
    invoiceUrl: null,
    externalReference: 'mock-order-id',
    split: [],
  }),
  getPixQrCode: async () => ({
    payload: 'mock-pix-payload',
    encodedImage: 'mock-encoded-image',
    expirationDate: null,
  }),
  verifyPayment: async () => ({
    status: 'approved',
    amount: 100,
    providerData: { id: 'mock-payment-id', status: 'CONFIRMED' },
  }),
  refundPayment: async () => ({
    id: 'mock-refund-id',
    status: 'REFUNDED',
    value: 100,
  }),
  getSellerWalletForOrder: async () => null,
};

let app: INestApplication;
let prismaService: PrismaService;
let isInitialized = false;

beforeAll(async () => {
  if (isInitialized) {
    return;
  }

  // Only use mock if no Asaas API key is configured
  // The .env file may have ASAAS_API_KEY as a literal string with $ prefix,
  // but when running with dotenv-cli -e .env.test, this env is NOT injected.
  const asaasKey = process.env.ASAAS_API_KEY;
  const useMockAsaas = !asaasKey || asaasKey.startsWith('$aact_');

  let moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (useMockAsaas) {
    moduleBuilder = moduleBuilder.overrideProvider(AsaasProvider).useValue(mockAsaasProvider);
  }

  const moduleRef = await moduleBuilder.compile();

  if (useMockAsaas) {
    console.log('🔧 Using mock AsaasProvider (no production API key)');
  }

  app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  // Try multiple ways to get PrismaService
  prismaService = moduleRef.get<PrismaService>(PrismaService);

  console.log('PrismaService obtained:', !!prismaService);
  console.log('Module:', moduleRef ? 'exists' : 'missing');
  console.log('App:', app ? 'exists' : 'missing');

  if (!prismaService) {
    prismaService = app.get<PrismaService>(PrismaService);
    console.log('PrismaService from app:', !!prismaService);
  }

  if (!prismaService) {
    throw new Error('PrismaService not found. Make sure PrismaModule is imported in AppModule.');
  }

  isInitialized = true;
  console.log('PrismaService initialized successfully');

  // Clean up any existing data
  await cleanupDatabase();
});

afterAll(async () => {
  try {
    if (prismaService) {
      await cleanupDatabase();
    }

    if (app) {
      await app.close();
    }
  } finally {
    if (prismaService) {
      await prismaService.$disconnect();
    }
  }
});

async function cleanupDatabase() {
  if (!prismaService) {
    return;
  }
  try {
    await prismaService.refreshToken.deleteMany();
    await prismaService.passwordResetToken.deleteMany();
    await prismaService.emailVerificationToken.deleteMany();
    await prismaService.emailChangeRequest.deleteMany();
    await prismaService.pendingRegistration.deleteMany();
    await prismaService.notification.deleteMany();
    await prismaService.payment.deleteMany();
    await prismaService.coupon.deleteMany();
    await prismaService.orderItem.deleteMany();
    await prismaService.order.deleteMany();
    await prismaService.cartItem.deleteMany();
    await prismaService.cart.deleteMany();
    await prismaService.key.deleteMany();
    await prismaService.product.deleteMany();
    await prismaService.category.deleteMany();
    await prismaService.seller.deleteMany();
    await prismaService.walletTransaction.deleteMany();
    await prismaService.wallet.deleteMany();
    await prismaService.userDeletionLog.deleteMany();
    await prismaService.user.deleteMany();
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Cleanup error:', error);
  }
}

export function getApp(): INestApplication {
  return app;
}

export function getPrismaService(): PrismaService {
  if (!prismaService) {
    console.error('PrismaService is not initialized yet!');
    console.error('Stack trace:', new Error().stack);
    throw new Error('PrismaService not initialized. Make sure tests import setup correctly.');
  }
  return prismaService;
}

export async function createTestUser(
  email: string = 'test@example.com',
  password: string = 'Test123!',
  name: string = 'Test User',
  role: Role = Role.USER,
) {
  return prismaService.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 1),
      name,
      role,
      emailVerified: true,
    },
  });
}

export async function cleanupTestData() {
  await cleanupDatabase();
}
