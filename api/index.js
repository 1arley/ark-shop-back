// Forces Vercel to include dynamic NestJS packages in the trace chain
require('@nestjs/axios');
require('axios');

// The full handler lives in dist/run.js (auto-generated during build).
// This file has no TypeScript counterpart (no src/run.ts), so Vercel's
// builder cannot prefer a TS source over the compiled JS output.
module.exports = require('../dist/run');
