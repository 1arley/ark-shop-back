import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto-js';

const prisma = new PrismaClient();

const ENCRYPTION_KEY =
  process.env.KEYS_ENCRYPTION_KEY || 'default-key-change-in-production';

function encryptKey(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

function generateDemoKey(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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

  // Create categories
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
    const category = await prisma.category.create({
      data: {
        name: categoryName,
        description: `${categoryName} games`,
      },
    });
    createdCategories.push(category);
    console.log(`  ✓ ${categoryName}`);
  }

  // Create products
  console.log('\n🎮 Creating products...');
  const products = [];
  for (let i = 0; i < 5; i++) {
    const category =
      createdCategories[Math.floor(Math.random() * createdCategories.length)];

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

  // Create keys for each product
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

  // Create test user
  console.log('\n👤 Creating test user...');
  const bcrypt = require('bcrypt');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'admin@darkgames.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log(`  ✓ ${user.email} (password: password123)`);

  console.log('\n✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
