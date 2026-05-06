import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, PaymentStatus, KeyStatus } from '@prisma/client';

interface DashboardStats {
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
  };
  keys: {
    total: number;
    available: number;
    reserved: number;
    delivered: number;
  };
  users: {
    total: number;
    activeToday: number;
  };
  payments: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    refunded: number;
  };
  recentOrders: any[];
  topProducts: any[];
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Revenue stats
    const revenueData = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.APPROVED },
    });

    const todayRevenue = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.APPROVED,
        createdAt: { gte: today },
      },
    });

    const weekRevenue = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.APPROVED,
        createdAt: { gte: weekAgo },
      },
    });

    const monthRevenue = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.APPROVED,
        createdAt: { gte: monthAgo },
      },
    });

    // Order stats
    const orderStats = await this.prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    const totalOrders = await this.prisma.order.count();

    // Product stats
    const productStats = await this.prisma.product.groupBy({
      by: ['isActive'],
      _count: true,
    });

    const lowStockProducts = await this.prisma.product.count({
      where: {
        stock: { lte: 5 },
        isActive: true,
      },
    });

    // Key stats
    const keyStats = await this.prisma.key.groupBy({
      by: ['status'],
      _count: true,
    });

    // User stats
    const totalUsers = await this.prisma.user.count();

    // Payment stats
    const paymentStats = await this.prisma.payment.groupBy({
      by: ['status'],
      _count: true,
    });

    // Recent orders
    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Top products
    const topProducts = await this.prisma.product.findMany({
      take: 10,
      include: {
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: {
        orderItems: {
          _count: 'desc',
        },
      },
    });

    const formatStats = (
      stats: Array<{ _count: number; status?: string }>,
      status?: string,
    ) => stats.find((s: any) => s.status === status)?._count || 0;

    return {
      revenue: {
        total: revenueData._sum.amount?.toNumber() || 0,
        today: todayRevenue._sum.amount?.toNumber() || 0,
        thisWeek: weekRevenue._sum.amount?.toNumber() || 0,
        thisMonth: monthRevenue._sum.amount?.toNumber() || 0,
      },
      orders: {
        total: totalOrders,
        pending: orderStats.find((s) => s.status === 'PENDING')?._count || 0,
        processing:
          orderStats.find((s) => s.status === 'PROCESSING')?._count || 0,
        completed: orderStats.find((s) => s.status === 'DELIVERED')?._count || 0,
        cancelled: orderStats.find((s) => s.status === 'CANCELLED')?._count || 0,
      },
      products: {
        total: productStats.reduce((acc, curr) => acc + curr._count, 0),
        active: productStats.find((p) => p.isActive === true)?._count || 0,
        inactive: productStats.find((p) => p.isActive === false)?._count || 0,
        lowStock: lowStockProducts,
      },
      keys: {
        total: keyStats.reduce((acc, curr) => acc + curr._count, 0),
        available: keyStats.find((k) => k.status === 'AVAILABLE')?._count || 0,
        reserved: keyStats.find((k) => k.status === 'RESERVED')?._count || 0,
        delivered: keyStats.find((k) => k.status === 'DELIVERED')?._count || 0,
      },
      users: {
        total: totalUsers,
        activeToday: 0, // Would need activity tracking
      },
      payments: {
        total: paymentStats.reduce((acc, curr) => acc + curr._count, 0),
        pending: paymentStats.find((p) => p.status === 'PENDING')?._count || 0,
        approved: paymentStats.find((p) => p.status === 'APPROVED')?._count || 0,
        rejected: paymentStats.find((p) => p.status === 'REJECTED')?._count || 0,
        refunded: paymentStats.find((p) => p.status === 'REFUNDED')?._count || 0,
      },
      recentOrders: recentOrders,
      topProducts: topProducts,
    };
  }

  async getFraudLogs(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.fraudLog.findMany({
        skip,
        take: limit,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fraudLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              orders: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSystemHealth() {
    const dbCheck = await this.prisma.$queryRaw`SELECT 1`;
    const productCount = await this.prisma.product.count();
    const orderCount = await this.prisma.order.count();
    const paymentCount = await this.prisma.payment.count();

    return {
      database: dbCheck ? 'healthy' : 'unhealthy',
      products: productCount,
      orders: orderCount,
      payments: paymentCount,
      timestamp: new Date(),
    };
  }
}
