import { execSync } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('Migrator');

function waitForDatabase(maxRetries = 30, delayMs = 2000): void {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('./node_modules/.bin/prisma validate --schema=./prisma/schema.prisma', {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
      });

      execSync('./node_modules/.bin/prisma db execute --schema=./prisma/schema.prisma --stdin', {
        input: 'SELECT 1',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
      });
      logger.log('Database connection established.');
      return;
    } catch {
      logger.log(`Waiting for database... (${i + 1}/${maxRetries})`);
      execSync(`sleep ${delayMs / 1000}`);
    }
  }
  throw new Error('Database not reachable after multiple retries');
}

export function runMigrations(): void {
  try {
    waitForDatabase();
    logger.log('Checking database migration status...');

    const status = execSync(
      './node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma',
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
      },
    );

    if (status.includes('Database schema is up to date')) {
      logger.log('Database is up to date. Skipping migrations.');
      return;
    }

    if (status.includes('pending')) {
      logger.log('Pending migrations detected. Applying...');

      const output = execSync(
        './node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma',
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
        },
      );

      if (output.includes('All migrations have been successfully applied')) {
        logger.log('Migrations applied successfully.');
        return;
      }

      logger.warn(`Unexpected migration output: ${output}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Migration failed: ${message}`);
    process.exit(1);
  }
}
