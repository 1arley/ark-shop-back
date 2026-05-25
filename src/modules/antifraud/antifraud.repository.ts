import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AntifraudRepository {
  private readonly logger = new Logger(AntifraudRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  createFraudLog(data: {
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

  /**
   * Verifica reputação de IP.
   *
   * ATENÇÃO: Esta é uma implementação placeholder que sempre retorna true (aprovado).
   * Para produção, integre com AbuseIPDB, ipqualityscore ou similar.
   *
   * TODO: Implementar verificação real de reputação de IP
   * Exemplo: GET https://api.abuseipdb.com/api/v2/check?ipAddress={ip}
   */
  checkIPReputation(_ipAddress: string): Promise<boolean> {
    this.logger.warn('IP reputation check not implemented — defaulting to approved');
    return Promise.resolve(true);
  }

  /**
   * Verifica se um device fingerprint está na lista negra.
   *
   * ATENÇÃO: Esta é uma implementação placeholder que sempre retorna false (não bloqueia).
   * Para produção, implemente um cache Redis de fingerprints suspeitos.
   *
   * TODO: Implementar verificação real de blacklist de devices
   */
  checkDeviceBlacklist(_deviceFingerprint: string): Promise<boolean> {
    this.logger.warn('Device blacklist check not implemented — defaulting to not blocked');
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

  getRecentFraudLogs(limit: number = 100) {
    return this.prisma.fraudLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}
