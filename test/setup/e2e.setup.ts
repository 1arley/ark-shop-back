import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';

let app: INestApplication;
let prismaService: PrismaService;
let isInitialized = false;

beforeAll(async () => {
  if (isInitialized) {
    return;
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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
