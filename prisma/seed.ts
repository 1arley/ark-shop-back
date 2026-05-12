import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as CryptoJS from 'crypto-js';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Carrega .env primeiro, depois .env.local (se existir) — mas NÃO sobrescreve
// variáveis já definidas no ambiente (ex: DATABASE_URL via CLI)
dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required but was not set.');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ENCRYPTION_KEY = process.env.KEYS_ENCRYPTION_KEY || 'default-key-change-in-production';

function encryptKey(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

function generateDemoKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return key;
}

async function main() {
  console.log('🌱 Starting seed...');

  const categories = [
    'Action',
    'Adventure',
    'RPG',
    'Strategy',
    'Sports',
    'Racing',
    'Simulation',
    'Horror',
  ];

  console.log('📁 Creating categories...');
  const createdCategories = [];
  for (const categoryName of categories) {
    const category = await prisma.category.upsert({
      where: { id: categoryName.toLowerCase() }, // evita duplicatas em re-seeds
      create: {
        name: categoryName,
        description: `${categoryName} games`,
      },
      update: {},
    });
    createdCategories.push(category);
    console.log(`  ✓ ${categoryName}`);
  }

  console.log('\n🎮 Creating products...');
  const products = [];
  for (let i = 0; i < 5; i++) {
    const category = createdCategories[Math.floor(Math.random() * createdCategories.length)]!;

    const product = await prisma.product.create({
      data: {
        name: `Game ${i + 1} - ${category.name}`,
        description: `Amazing ${category.name.toLowerCase()} game #${i + 1}`,
        price: Math.floor(Math.random() * 50) + 9.99,
        stock: 10,
        isActive: true,
        categoryId: category.id,
      },
    });

    products.push(product);
    console.log(`  ✓ ${product.name}`);
  }

  console.log('\n🔑 Creating keys...');
  for (const product of products) {
    const keys = Array.from({ length: 10 }, () => generateDemoKey());

    for (const key of keys) {
      await prisma.key.create({
        data: {
          productId: product.id,
          keyData: encryptKey(key),
          status: 'AVAILABLE',
        },
      });
    }

    console.log(`  ✓ ${product.name}: 10 keys created`);
  }

  console.log('\n👤 Creating test users...');
  const adminPassword = await bcrypt.hash('password123', 10);
  const userPassword = await bcrypt.hash('user1234', 10);

  await prisma.user.upsert({
    where: { email: 'admin@darkgames.com' },
    update: {},
    create: {
      email: 'admin@darkgames.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('  ✓ admin@darkgames.com (senha: password123)');

  await prisma.user.upsert({
    where: { email: 'user@darkgames.com' },
    update: {},
    create: {
      email: 'user@darkgames.com',
      password: userPassword,
      name: 'Regular User',
      role: 'USER',
    },
  });
  console.log('  ✓ user@darkgames.com (senha: user1234)');

  console.log('\n✅ Seed completed!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
