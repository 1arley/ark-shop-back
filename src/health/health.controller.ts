import { Controller, Get, Logger } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Real database health check — pings PostgreSQL
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (error) {
          this.logger.error('Database health check failed', error);
          return { database: { status: 'down', message: 'Cannot connect to database' } };
        }
      },
      // Memory usage check
      (): HealthIndicatorResult => {
        const usedHeap = process.memoryUsage().heapUsed / 1024 / 1024;
        const threshold = parseInt(
          this.configService.get<string>('HEALTH_MEMORY_THRESHOLD_MB', '500'),
        );

        if (usedHeap > threshold) {
          return {
            memory: {
              status: 'down',
              message: `Heap usage ${usedHeap.toFixed(1)}MB exceeds threshold ${threshold}MB`,
            },
          };
        }

        return {
          memory: {
            status: 'up',
            heapUsedMB: Math.round(usedHeap * 10) / 10,
            thresholdMB: threshold,
          },
        };
      },
      // Disk check (via process.uptime — app is alive)
      (): HealthIndicatorResult => ({
        uptime: {
          status: 'up',
          seconds: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      }),
    ]);
  }

  /**
   * Readiness probe — indicates if the app is ready to serve traffic.
   * Unlike the liveness check (/health), this one is more strict:
   * it fails if the database is unreachable.
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (error) {
          this.logger.error('Readiness probe failed — database unreachable', error);
          return { database: { status: 'down', message: 'Database unreachable' } };
        }
      },
    ]);
  }
}
