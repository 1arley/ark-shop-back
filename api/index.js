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
