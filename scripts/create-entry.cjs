const fs = require('fs');
const path = require('path');

const content = [
  'const { createApp } = require("./main");',
  'module.exports = { createApp };',
  '',
].join('\n');

const dest = path.join(__dirname, '..', 'dist', 'entry.js');
fs.writeFileSync(dest, content);
console.log('Created dist/entry.js');
