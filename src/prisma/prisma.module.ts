import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * PrismaModule provides the PrismaService database client.
 *
 * NOTE: This module is NOT marked @Global() — every module that needs
 * database access must explicitly import PrismaModule in its `imports` array.
 * This makes all database dependencies visible and testable without mocks
 * leaking across module boundaries.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
