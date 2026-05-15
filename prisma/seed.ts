import { PrismaClient, Role } from '@prisma/client';
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
  console.log('🌱 Starting seed...');

  // Limpar banco de dados (ordem importante para evitar FK constraints)
  console.log('🧹 Limpando banco de dados...');

  // 1. Deletar dependentes primeiro
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.key.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fraudLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Banco limpo');

  // Criar 3 categorias iniciais
  console.log('📁 Criando categorias...');
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'XBOX',
        description: 'Jogos e produtos para plataforma Xbox',
      },
    }),
    prisma.category.create({
      data: {
        name: 'STEAM/PC',
        description: 'Jogos e produtos para Steam/PC',
      },
    }),
    prisma.category.create({
      data: {
        name: 'NINTENDO E-SHOP',
        description: 'Jogos e produtos para Nintendo',
      },
    }),
  ]);

  console.log(`✅ ${categories.length} categorias criadas`);

  // Criar 3 contas principais
  console.log('👥 Criando contas principais...');

  const hashedPassword = await bcrypt.hash('mudar123', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@ark.com',
        name: 'Admin User',
        password: hashedPassword,
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: 'superadmin@ark.com',
        name: 'Super Admin',
        password: hashedPassword,
        role: Role.SUPERADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: 'user@ark.com',
        name: 'Regular User',
        password: hashedPassword,
        role: Role.USER,
      },
    }),
  ]);

  console.log(`✅ ${users.length} contas criadas`);
  console.log('');
  console.log('📊 Resumo do seed:');
  console.log(` - Categorias: ${categories.length}`);
  console.log(` - Contas: ${users.length}`);
  console.log('');
  console.log('🔐 Credenciais:');
  console.log(' Admin: admin@ark.com / mudar123');
  console.log(' SuperAdmin: superadmin@ark.com / mudar123');
  console.log(' User: user@ark.com / mudar123');
  console.log('');
  console.log('🎉 Seed concluído com sucesso!');
}

main()
  .catch(e => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
