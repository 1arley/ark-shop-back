import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

dotenv.config({
  path: path.resolve(process.cwd(), isTest ? '.env.test' : '.env'),
});

if (!isProduction && !isTest) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
