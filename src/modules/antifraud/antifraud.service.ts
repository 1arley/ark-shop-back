import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AntifraudRepository } from './antifraud.repository';

interface RiskAnalysisInput {
  userId?: string;
  orderId?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  amount?: number;
}

@Injectable()
export class AntifraudService {
  constructor(
    private readonly antifraudRepository: AntifraudRepository,
    private readonly configService: ConfigService,
  ) {}

  async analyzeRisk(input: RiskAnalysisInput) {
    const { userId, orderId, ipAddress, deviceFingerprint, amount = 0 } = input;

    const checks = {
      ipReputation: true,
      velocityCheck: true,
      blacklistCheck: true,
      deviceCheck: true,
    };

    let riskScore = 0;
    let reason: string | undefined;

    // Execute all checks in parallel to avoid N+1 query problem
    const [ipReputationResult, deviceBlacklistResult, userOrderCount, userPaymentSuccessRate] =
      await Promise.all([
        ipAddress ? this.antifraudRepository.checkIPReputation(ipAddress) : Promise.resolve(true),
        deviceFingerprint
          ? this.antifraudRepository.checkDeviceBlacklist(deviceFingerprint)
          : Promise.resolve(false),
        userId ? this.antifraudRepository.getUserOrderCount(userId, 24) : Promise.resolve(0),
        userId ? this.antifraudRepository.getUserPaymentSuccessRate(userId) : Promise.resolve(1),
      ]);

    // Check IP reputation
    if (ipAddress) {
      checks.ipReputation = ipReputationResult;
      if (!checks.ipReputation) {
        riskScore += 40;
        reason = 'Blacklisted IP';
      }
    }

    // Check device fingerprint
    if (deviceFingerprint) {
      const isBlacklisted = deviceBlacklistResult;
      if (isBlacklisted) {
        riskScore += 30;
        reason = reason ? reason + '; Blacklisted device' : 'Blacklisted device';
      }
    }

    // Velocity check (orders in last 24 hours)
    if (userId) {
      const orderCount = userOrderCount;
      if (orderCount > 5) {
        checks.velocityCheck = false;
        riskScore += 20;
        reason = reason ? reason + '; High velocity' : 'High velocity';
      }

      // Payment success rate
      const successRate = userPaymentSuccessRate;
      if (successRate < 0.5) {
        riskScore += 15;
        reason = reason ? reason + '; Low success rate' : 'Low success rate';
      }
    }

    // High amount check
    if (amount && amount > 1000) {
      riskScore += 10;
      reason = reason ? reason + '; High amount' : 'High amount';
    }

    // Determine risk level and decision
    const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW';

    let decision: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED' = 'APPROVED';

    if (riskScore >= 70) {
      decision = 'REJECTED';
    } else if (riskScore >= 30) {
      decision = 'MANUAL_REVIEW';
    }

    // Log fraud analysis
    if (userId || orderId) {
      await this.antifraudRepository.createFraudLog({
        userId: userId || undefined,
        orderId: orderId || undefined,
        riskScore,
        riskLevel,
        checks,
        ipAddress: ipAddress || undefined,
        deviceFingerprint: deviceFingerprint || undefined,
        decision,
        reason,
      });
    }

    return {
      riskScore,
      riskLevel,
      decision,
      checks,
      reason,
    };
  }

  async getFraudLogs(limit: number = 100) {
    return await this.antifraudRepository.getRecentFraudLogs(limit);
  }
}
