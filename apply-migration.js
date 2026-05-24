const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Carrega .env se existir
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Running migration: Adding imageUrl column to Product table...');
  
  try {
    // Tenta adicionar a coluna imageUrl
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" 
      ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Column "imageUrl" added to "Product" table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
