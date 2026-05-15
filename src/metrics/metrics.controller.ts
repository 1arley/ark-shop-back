import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { register } from 'prom-client';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Authenticated metrics endpoint (requires ADMIN/SUPERADMIN).
   * Use METRICS_REQUIRE_AUTH=false to allow unauthenticated access
   * for container orchestrators on internal networks.
   */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  async getAdminMetrics(): Promise<string> {
    return register.metrics();
  }
}
