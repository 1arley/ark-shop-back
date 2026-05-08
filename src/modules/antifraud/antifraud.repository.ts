import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// interface RiskAnalysisResult {
//   riskScore: number;
//   riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
//   decision: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
//   checks: {
//     ipReputation: boolean;
//     velocityCheck: boolean;
//     blacklistCheck: boolean;
//     deviceCheck: boolean;
//   };
//   reason?: string;
// }

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
}
