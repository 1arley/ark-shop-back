import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test before any modules are imported
// This ensures EXPOSE_AUTH_TOKENS_IN_RESPONSE is set before auth.controller.ts evaluates it
// rootDir is 'src', so we need to go up one level to find .env.test
config({ path: resolve(__dirname, '../../.env.test') });
