import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Limpar banco
  console.log('🧹 Limpando banco de dados...');
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.key.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fraudLog.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.seller.deleteMany();
  console.log('✅ Banco limpo');

  // Criar categorias
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
    prisma.category.create({
      data: {
        name: 'PLAYSTATION',
        description: 'Jogos e produtos para PlayStation',
      },
    }),
  ]);

  console.log(`✅ ${categories.length} categorias criadas`);

  // Criar usuários
  console.log('👥 Criando usuários...');

  const hashedPassword = await bcrypt.hash('mudar123', 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@ark.com' },
      update: {},
      create: {
        email: 'admin@ark.com',
        name: 'Admin User',
        password: hashedPassword,
        role: Role.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: 'superadmin@ark.com' },
      update: {},
      create: {
        email: 'superadmin@ark.com',
        name: 'Super Admin',
        password: hashedPassword,
        role: Role.SUPERADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: 'user@ark.com' },
      update: {},
      create: {
        email: 'user@ark.com',
        name: 'Regular User',
        password: hashedPassword,
        role: Role.USER,
      },
    }),
  ]);

  console.log(`✅ ${users.length} usuários criados`);
  console.log('');
  console.log('📊 Resumo do seed:');
  console.log(`   - Categorias: ${categories.length}`);
  console.log(`   - Usuários: ${users.length}`);
  console.log('');
  console.log('🔐 Credenciais:');
  console.log('   Admin: admin@ark.com / mudar123');
  console.log('   SuperAdmin: superadmin@ark.com / mudar123');
  console.log('   User: user@ark.com / mudar123');
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
