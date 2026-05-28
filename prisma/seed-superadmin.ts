import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: process.env.NODE_ENV !== 'production' });

const databaseUrl = requireEnv('DATABASE_URL');
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const email = requireEnv('SEED_SUPERADMIN_EMAIL').toLowerCase();
  const password = requireEnv('SEED_SUPERADMIN_PASSWORD');
  const name = process.env.SEED_SUPERADMIN_NAME?.trim() || 'Super Admin';

  assertStrongPassword('SEED_SUPERADMIN_PASSWORD', password);

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: 'SUPERADMIN',
      emailVerified: true,
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role: 'SUPERADMIN',
      emailVerified: true,
    },
    select: {
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });

  await prisma.pendingRegistration.deleteMany({ where: { email } });

  console.log('Superadmin seed completed successfully.');
  console.log(`Email: ${user.email}`);
  console.log(`Name: ${user.name}`);
  console.log(`Role: ${user.role}`);
  console.log(`Email verified: ${user.emailVerified}`);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function assertStrongPassword(envName: string, password: string): void {
  const hasMinimumLength = password.length >= 12;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasMinimumLength || !hasLowercase || !hasUppercase || !hasNumber || !hasSymbol) {
    throw new Error(
      `${envName} must have at least 12 chars, uppercase, lowercase, number and symbol.`,
    );
  }
}

main()
  .catch(error => {
    console.error('Superadmin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
