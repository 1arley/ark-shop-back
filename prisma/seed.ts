import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const userPassword = await bcrypt.hash('User123!', 10);

  // Create test users
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      id: '1',
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      id: '2',
      email: 'user@example.com',
      password: userPassword,
      name: 'Regular User',
      role: 'USER',
    },
  });

  console.log('Database seeded successfully!');
  console.log('Admin: admin@example.com / Admin123!');
  console.log('User: user@example.com / User123!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });