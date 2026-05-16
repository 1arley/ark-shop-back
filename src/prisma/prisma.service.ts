import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Pool } from 'pg';
import { DB_CONNECTION_TIMEOUT_MS } from '@/common/constants';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const provider = process.env.DATABASE_PROVIDER || 'postgresql';

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is required but was not set. ' +
          'Configure it in your environment variables.',
      );
    }

    if (provider === 'sqlite') {
      const adapter = new PrismaLibSql({ url: databaseUrl });
      super({ adapter });
    } else {
      const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS, // 10s timeout — fail fast instead of hanging
      });
      const adapter = new PrismaPg(pool);
      super({ adapter });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error(`Database connection failed: ${String(error)}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(error => {
      this.logger.warn(`Database disconnect warning during shutdown: ${String(error)}`);
    });
  }
}
