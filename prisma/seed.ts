import { Prisma, PrismaClient } from '@prisma/client';
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

type SeedAdminUser = {
  email: string;
  name: string;
  password: string;
  role: 'ADMIN' | 'SUPERADMIN';
};

type PreparedSeedAdminUser = Omit<SeedAdminUser, 'password'> & {
  passwordHash: string;
};

const categories = [
  {
    name: 'XBOX',
    slug: 'xbox',
    description: 'Jogos, gift cards e contas para Xbox.',
  },
  {
    name: 'STEAM/PC',
    slug: 'steam-pc',
    description: 'Jogos, gift cards e contas para Steam e PC.',
  },
  {
    name: 'NINTENDO E-SHOP',
    slug: 'nintendo-e-shop',
    description: 'Jogos, gift cards e contas para Nintendo.',
  },
  {
    name: 'PLAYSTATION',
    slug: 'playstation',
    description: 'Jogos, gift cards e contas para PlayStation.',
  },
];

async function main(): Promise<void> {
  console.log('Starting production seed...');

  const admin = getAdminSeedUser('SEED_ADMIN', 'ADMIN');
  const superadmin = getAdminSeedUser('SEED_SUPERADMIN', 'SUPERADMIN');
  validateSeedUsers(admin, superadmin);

  const preparedAdmin = await prepareSeedUser(admin);
  const preparedSuperadmin = await prepareSeedUser(superadmin);

  const [categoryCount, adminUser, superadminUser] = await prisma.$transaction(async tx => {
    const upsertedCategories = await Promise.all(
      categories.map(category =>
        tx.category.upsert({
          where: { slug: category.slug },
          update: {
            name: category.name,
            description: category.description,
            isDemo: false,
          },
          create: {
            ...category,
            isDemo: false,
          },
        }),
      ),
    );

    const seededAdmin = await upsertAdminUser(tx, preparedAdmin);
    const seededSuperadmin = await upsertAdminUser(tx, preparedSuperadmin);

    await tx.pendingRegistration.deleteMany({
      where: {
        email: {
          in: [preparedAdmin.email, preparedSuperadmin.email],
        },
      },
    });

    return [upsertedCategories.length, seededAdmin, seededSuperadmin] as const;
  });

  console.log('Production seed completed successfully.');
  console.log(`Categories upserted: ${categoryCount}`);
  console.log(`Admin ready: ${adminUser.email}`);
  console.log(`Superadmin ready: ${superadminUser.email}`);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for production seed.`);
  }

  return value;
}

function getAdminSeedUser(
  prefix: 'SEED_ADMIN' | 'SEED_SUPERADMIN',
  role: SeedAdminUser['role'],
): SeedAdminUser {
  const email = requireEnv(`${prefix}_EMAIL`).toLowerCase();
  const password = requireEnv(`${prefix}_PASSWORD`);
  const name = process.env[`${prefix}_NAME`]?.trim() || defaultNameFor(role);

  assertStrongPassword(`${prefix}_PASSWORD`, password);

  return {
    email,
    name,
    password,
    role,
  };
}

function defaultNameFor(role: SeedAdminUser['role']): string {
  return role === 'SUPERADMIN' ? 'Super Admin' : 'Admin';
}

function validateSeedUsers(admin: SeedAdminUser, superadmin: SeedAdminUser): void {
  if (admin.email === superadmin.email) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_SUPERADMIN_EMAIL must be different.');
  }

  if (admin.password === superadmin.password) {
    throw new Error('SEED_ADMIN_PASSWORD and SEED_SUPERADMIN_PASSWORD must be different.');
  }
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

async function prepareSeedUser(seedUser: SeedAdminUser): Promise<PreparedSeedAdminUser> {
  const passwordHash = await bcrypt.hash(seedUser.password, 12);

  return {
    email: seedUser.email,
    name: seedUser.name,
    passwordHash,
    role: seedUser.role,
  };
}

async function upsertAdminUser(
  tx: Prisma.TransactionClient,
  seedUser: PreparedSeedAdminUser,
): Promise<{ email: string }> {
  return tx.user.upsert({
    where: { email: seedUser.email },
    update: {
      name: seedUser.name,
      password: seedUser.passwordHash,
      role: seedUser.role,
      emailVerified: true,
    },
    create: {
      email: seedUser.email,
      name: seedUser.name,
      password: seedUser.passwordHash,
      role: seedUser.role,
      emailVerified: true,
    },
    select: {
      email: true,
    },
  });
}

main()
  .catch(error => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
