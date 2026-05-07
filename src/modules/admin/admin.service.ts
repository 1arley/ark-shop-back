import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminRepository } from './admin.repository';
import { KeysService } from '@/modules/keys/keys.service';
import { ProductsService } from '@/modules/products/products.service';
import { GenerateDemoDataDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly prisma: PrismaService,
    private readonly keysService: KeysService,
    private readonly productsService: ProductsService,
  ) {}

  async getDashboardStats() {
    return this.adminRepository.getDashboardStats();
  }

  async getFraudLogs(page: number, limit: number) {
    return this.adminRepository.getFraudLogs(page, limit);
  }

  async getAllUsers(page: number, limit: number) {
    return this.adminRepository.getAllUsers(page, limit);
  }

  async getSystemHealth() {
    return this.adminRepository.getSystemHealth();
  }

  async bulkImportKeys(productId: string, keysText: string, isCsv = false) {
    let keys: string[];

    if (isCsv) {
      keys = keysText
        .split('\n')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    } else {
      keys = keysText
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }

    if (keys.length === 0) {
      throw new BadRequestException('No keys to import');
    }

    return this.keysService.importKeys(productId, keys);
  }

  async generateDemoData(productsCount = 5, keysPerProduct = 10) {
    const categories = [
      'Action',
      'Adventure',
      'RPG',
      'Strategy',
      'Sports',
      'Racing',
      'Simulation',
      'Horror',
    ];

    const createdCategories = [];

    // Create categories
    for (const categoryName of categories) {
      const category = await this.prisma.category.create({
        data: {
          name: categoryName,
          description: `${categoryName} games`,
        },
      });
      createdCategories.push(category);
    }

    const products = [];

    // Create products
    for (let i = 0; i < productsCount; i++) {
      const category =
        createdCategories[Math.floor(Math.random() * createdCategories.length)];

      const product = await this.prisma.product.create({
        data: {
          name: `Game ${i + 1} - ${category!.name}`,
          description: `Amazing ${category!.name.toLowerCase()} game #${i + 1}`,
          price: Math.floor(Math.random() * 50) + 9.99,
          stock: keysPerProduct,
          isActive: true,
          categoryId: category!.id,
        },
      });

      products.push(product);

      // Generate keys for this product
      const keys = Array.from({ length: keysPerProduct }, () =>
        this.generateDemoKey(),
      );

      await this.keysService.importKeys(product.id, keys);
    }

    return {
      categories: createdCategories.length,
      products: products.length,
      keys: products.length * keysPerProduct,
    };
  }

  private generateDemoKey(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      if (i > 0) key += '-';
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return key;
  }

  async clearDemoData() {
    // Delete in order to avoid FK issues
    await this.prisma.fraudLog.deleteMany();
    await this.prisma.notification.deleteMany();
    await this.prisma.walletTransaction.deleteMany();
    await this.prisma.wallet.deleteMany();
    await this.prisma.payment.deleteMany();
    await this.prisma.orderItem.deleteMany();
    await this.prisma.order.deleteMany();
    await this.prisma.key.deleteMany();
    await this.prisma.product.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.seller.deleteMany();
    await this.prisma.refreshToken.deleteMany();
    await this.prisma.user.deleteMany();

    return { message: 'Demo data cleared' };
  }
}
