import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash('12345678', 10);

  const user = await prisma.user.upsert({
    where: { email: 'superadmin@darkgames.com' },
    update: {},
    create: {
      email: 'superadmin@darkgames.com',
      password,
      name: 'Super Admin',
      role: 'SUPERADMIN',
    },
  });

  console.log('✅ SUPERADMIN created:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Name:  ${user.name}`);
  console.log(`   Role:  ${user.role}`);
  console.log(`   Pass:  12345678`);
}

main()
  .catch(e => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
