import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

interface RiskAnalysisResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  checks: {
    ipReputation: boolean;
    velocityCheck: boolean;
    blacklistCheck: boolean;
    deviceCheck: boolean;
  };
  reason?: string;
}

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
  }) {
    return this.prisma.fraudLog.create({
      data,
    });
  }

  async getUserOrderCount(userId: string, hours: number = 24) {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

    const count = await this.prisma.order.count({
      where: {
        userId,
        createdAt: { gte: hoursAgo },
      },
    });

    return count;
  }

  async getUserPaymentSuccessRate(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      select: { status: true },
    });

    if (payments.length === 0) return 1;

    const successCount = payments.filter(
      (p) => p.status === 'APPROVED',
    ).length;

    return successCount / payments.length;
  }

  async checkIPReputation(ipAddress: string): Promise<boolean> {
    // In production, integrate with IP reputation services
    // For now, simple blacklist check
    const blacklistedIPs = process.env.BLACKLISTED_IPS?.split(',') || [];
    return !blacklistedIPs.includes(ipAddress);
  }

  async checkDeviceBlacklist(deviceFingerprint: string): Promise<boolean> {
    // Check if device has been flagged for fraud
    const fraudLogs = await this.prisma.fraudLog.findMany({
      where: {
        deviceFingerprint,
        decision: 'REJECTED',
      },
      take: 5,
    });

    return fraudLogs.length >= 5;
  }

  async getRecentFraudLogs(limit: number = 100) {
    return this.prisma.fraudLog.findMany({
      take: limit,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
