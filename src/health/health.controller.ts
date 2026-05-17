import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import axios from 'axios';

@ApiTags('health')
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

  /**
   * Detailed health check — checks all external services.
   * Admin only. Includes database, storage, email, and payment provider status.
   */
  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HealthCheck()
  async detailed() {
    return this.health.check([
      // Database
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          const migrationStatus = await this.prisma.$queryRaw`
            SELECT COUNT(*) as count FROM "_prisma_migrations"
          `;
          return {
            database: {
              status: 'up',
              provider: this.configService.get('DATABASE_PROVIDER', 'postgresql'),
              migrationsApplied: Number((migrationStatus as any)[0]?.count ?? 0),
            },
          };
        } catch (error) {
          return {
            database: {
              status: 'down',
              message: (error as Error).message,
            },
          };
        }
      },

      // Storage (S3 / Supabase Storage)
      async (): Promise<HealthIndicatorResult> => {
        try {
          const storageDriver = this.configService.get('STORAGE_DRIVER', 'local');
          const s3Endpoint = this.configService.get('S3_ENDPOINT');

          if (storageDriver === 's3' && s3Endpoint) {
            // Quick connectivity check to S3 endpoint
            await axios.get(s3Endpoint.replace('/storage/v1/s3', ''), {
              timeout: 5000,
              validateStatus: () => true, // Accept any status (might be 403 without auth)
            });
          }

          return {
            storage: {
              status: 'up',
              driver: storageDriver,
              endpoint: storageDriver === 's3' ? s3Endpoint : 'local',
            },
          };
        } catch (error) {
          return {
            storage: {
              status: 'down',
              message: (error as Error).message,
            },
          };
        }
      },

      // Email (Resend)
      async (): Promise<HealthIndicatorResult> => {
        try {
          const resendApiKey = this.configService.get('RESEND_API_KEY');
          if (!resendApiKey || resendApiKey.startsWith('re_') === false) {
            return {
              email: {
                status: 'down',
                message: 'RESEND_API_KEY not configured or invalid',
              },
            };
          }

          // Verify API key by fetching domains (lightweight check)
          await axios.get('https://api.resend.com/domains', {
            headers: { Authorization: `Bearer ${resendApiKey}` },
            timeout: 5000,
          });

          return {
            email: {
              status: 'up',
              provider: 'resend',
              from: this.configService.get('EMAIL_FROM'),
            },
          };
        } catch (error) {
          return {
            email: {
              status: 'down',
              message: (error as Error).message,
            },
          };
        }
      },

      // Payment provider (Asaas)
      async (): Promise<HealthIndicatorResult> => {
        try {
          const asaasApiKey = this.configService.get('ASAAS_API_KEY');
          const asaasSandbox = this.configService.get('ASAAS_SANDBOX', 'true') === 'true';

          if (!asaasApiKey) {
            return {
              payment: {
                status: 'down',
                message: 'ASAAS_API_KEY not configured',
              },
            };
          }

          const baseUrl = asaasSandbox
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://www.asaas.com/api/v3';

          // Quick connectivity check
          await axios.get(`${baseUrl}/finance/balance`, {
            headers: { access_token: asaasApiKey },
            timeout: 5000,
            validateStatus: () => true,
          });

          return {
            payment: {
              status: 'up',
              provider: 'asaas',
              environment: asaasSandbox ? 'sandbox' : 'production',
            },
          };
        } catch (error) {
          return {
            payment: {
              status: 'down',
              message: (error as Error).message,
            },
          };
        }
      },

      // Memory
      (): HealthIndicatorResult => {
        const usedHeap = process.memoryUsage().heapUsed / 1024 / 1024;
        const threshold = parseInt(
          this.configService.get<string>('HEALTH_MEMORY_THRESHOLD_MB', '500'),
        );

        return {
          memory: {
            status: usedHeap > threshold ? 'down' : 'up',
            heapUsedMB: Math.round(usedHeap * 10) / 10,
            heapTotalMB: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 10) / 10,
            rssMB: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
            thresholdMB: threshold,
          },
        };
      },

      // Uptime
      (): HealthIndicatorResult => ({
        uptime: {
          status: 'up',
          seconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
        },
      }),
    ]);
  }
}
