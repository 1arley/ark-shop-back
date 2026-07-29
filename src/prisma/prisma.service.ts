import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Pool } from 'pg';
import {
  DB_CONNECTION_TIMEOUT_MS,
  DEFAULT_DB_POOL_IDLE_MS,
  DEFAULT_DB_POOL_MAX,
} from '@/common/constants';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pgPool: Pool | null;

  constructor() {
    const provider = process.env.DATABASE_PROVIDER || 'postgresql';
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is required but was not set. ' +
          'Configure it in your environment variables.',
      );
    }

    let pgPool: Pool | null = null;

    if (provider === 'sqlite') {
      const adapter = new PrismaLibSql({ url: databaseUrl });
      super({ adapter });
    } else {
      const poolMax = parseInt(process.env.DB_POOL_MAX || String(DEFAULT_DB_POOL_MAX), 10);
      const idleTimeoutMillis = parseInt(
        process.env.DB_POOL_IDLE_MS || String(DEFAULT_DB_POOL_IDLE_MS),
        10,
      );

      pgPool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
        max: Number.isNaN(poolMax) ? DEFAULT_DB_POOL_MAX : poolMax,
        idleTimeoutMillis: Number.isNaN(idleTimeoutMillis)
          ? DEFAULT_DB_POOL_IDLE_MS
          : idleTimeoutMillis,
      });
      const adapter = new PrismaPg(pgPool);
      super({ adapter });
    }

    this.pgPool = pgPool;
  }

  async onModuleInit() {
    const maxRetries = 10;
    const delayMs = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          this.logger.error(
            `Database connection failed after ${maxRetries} retries: ${String(error)}`,
          );
          throw error;
        }
        this.logger.warn(`Database connection attempt ${i + 1}/${maxRetries} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(error => {
      this.logger.warn(`Database disconnect warning during shutdown: ${String(error)}`);
    });

    if (this.pgPool) {
      await this.pgPool.end().catch(error => {
        this.logger.warn(`Connection pool shutdown warning: ${String(error)}`);
      });
    }
  }
}
