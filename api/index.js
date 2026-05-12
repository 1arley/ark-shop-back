// 1. Força o compilador da Vercel a incluir os pacotes dinâmicos do NestJS no build
require('@nestjs/axios');
require('axios');

// 2. Mapeia os path aliases do TypeScript para funcionarem no Node.js em produção
const path = require('path');
const moduleAlias = require('module-alias');

moduleAlias.addAliases({
  '@utils': path.resolve(__dirname, '../dist/utils'),
  '@': path.resolve(__dirname, '../dist'),
  '~': path.resolve(__dirname, '../dist'),
  '@test': path.resolve(__dirname, '../test')
});

// Vercel Serverless Function entrypoint
// Uses compiled dist/ output from nest build
const { createApp } = require('../dist/main');

let cachedApp;

module.exports = async (req, res) => {
  if (!cachedApp) {
    const app = await createApp();
    cachedApp = app.getHttpAdapter().getInstance();
  }
  cachedApp(req, res);
};