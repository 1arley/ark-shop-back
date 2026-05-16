import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'path';

// Carrega .env na raiz do projeto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
