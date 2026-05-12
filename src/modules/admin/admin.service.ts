import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { AdminRepository } from './admin.repository';
import { KeysService } from '@/modules/keys/keys.service';
import { ProductsService } from '@/modules/products/products.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly prisma: PrismaService,
    private readonly keysService: KeysService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
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

  // ─── Products ─────────────────────────────────────────────

  async findAllProducts(page: number, limit: number, search?: string) {
    return this.adminRepository.findAllProducts(page, limit, search);
  }

  async createProduct(dto: any) {
    return this.productsService.create(dto);
  }

  async updateProduct(id: string, dto: any) {
    return this.productsService.update(id, dto);
  }

  async deleteProduct(id: string) {
    const orderCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });
    if (orderCount > 0) {
      throw new ConflictException(
        `Cannot delete product with ${orderCount} associated order(s). Remove or archive the product instead.`,
      );
    }
    return this.productsService.delete(id);
  }

  async addKeysToProduct(productId: string, keys: string[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const result = await this.keysService.importKeys(productId, keys);
    return { count: result.imported };
  }

  // ─── Orders ───────────────────────────────────────────────

  async findAllOrders(page: number, limit: number, status?: string) {
    return this.adminRepository.findAllOrders(page, limit, status);
  }

  async updateOrderStatus(id: string, status: string) {
    return this.ordersService.updateStatus(id, status as OrderStatus);
  }

  // ─── Keys ─────────────────────────────────────────────────

  async findAllKeys(page: number, limit: number, productId?: string) {
    return this.adminRepository.findAllKeys(page, limit, productId);
  }

  async bulkImportKeys(productId: string, keysText: string, isCsv = false) {
    let keys: string[];

    if (isCsv) {
      keys = keysText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    } else {
      keys = keysText
        .split(/[,\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
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
      const category = createdCategories[Math.floor(Math.random() * createdCategories.length)];

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
      const keys = Array.from({ length: keysPerProduct }, () => this.generateDemoKey());

      await this.keysService.importKeys(product.id, keys);
    }

    return {
      categories: createdCategories.length,
      products: products.length,
      keys: products.length * keysPerProduct,
    };
  }

  private generateDemoKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      if (i > 0) key += '-';
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return key;
  }

  async clearDemoData(confirmationToken: string) {
    const expected = this.configService.get<string>('CLEAR_DEMO_TOKEN');

    if (!expected || confirmationToken !== expected) {
      throw new ForbiddenException('Invalid or missing confirmation token.');
    }

    // Delete in order to avoid FK issues — wrapped in a transaction for atomicity
    await this.prisma.$transaction([
      this.prisma.fraudLog.deleteMany(),
      this.prisma.notification.deleteMany(),
      this.prisma.walletTransaction.deleteMany(),
      this.prisma.wallet.deleteMany(),
      this.prisma.payment.deleteMany(),
      this.prisma.orderItem.deleteMany(),
      this.prisma.order.deleteMany(),
      this.prisma.key.deleteMany(),
      this.prisma.product.deleteMany(),
      this.prisma.category.deleteMany(),
      this.prisma.seller.deleteMany(),
      this.prisma.refreshToken.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);

    return { message: 'Demo data cleared' };
  }
}
