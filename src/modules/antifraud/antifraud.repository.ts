import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AntifraudRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFraudLog(data: {
    userId?: string;
    orderId?: string;
    riskScore: number;
    riskLevel: string;
    checks: any;
    ipAddress?: string;
    deviceFingerprint?: string;
    decision: string;
    reason?: string;
  }): Promise<any> {
    return this.prisma.fraudLog.create({
      data: {
        userId: data.userId,
        orderId: data.orderId,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        checks: data.checks,
        ipAddress: data.ipAddress,
        deviceFingerprint: data.deviceFingerprint,
        decision: data.decision,
        reason: data.reason,
      },
    });
  }

  async getFraudStats(orderId: string): Promise<any> {
    const logs = await this.prisma.fraudLog.findMany({
      where: { orderId },
      select: {
        riskScore: true,
        riskLevel: true,
        decision: true,
        reason: true,
      },
    });

    return {
      fraudLogs: logs,
      averageRiskScore: logs.reduce((acc, log) => acc + log.riskScore, 0) / logs.length || 0,
    };
  }

  checkIPReputation(_ipAddress: string): Promise<boolean> {
    // TODO: Implement actual IP reputation check
    return Promise.resolve(true);
  }

  checkDeviceBlacklist(_deviceFingerprint: string): Promise<boolean> {
    // TODO: Implement actual device blacklist check
    return Promise.resolve(false);
  }

  async getUserOrderCount(userId: string, hours: number = 24): Promise<number> {
    const orders = await this.prisma.order.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - hours * 60 * 60 * 1000),
        },
      },
    });
    return orders;
  }

  async getUserPaymentSuccessRate(userId: string): Promise<number> {
    const [total, approved] = await Promise.all([
      this.prisma.payment.count({
        where: { order: { userId } },
      }),
      this.prisma.payment.count({
        where: { order: { userId }, status: 'APPROVED' },
      }),
    ]);

    if (total === 0) {
      return 1;
    }

    return approved / total;
  }

  async getRecentFraudLogs(limit: number = 100) {
    return this.prisma.fraudLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}
