/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const { existsSync } = require('fs');

function checkRequirements() {
  const errors = [];

  if (!existsSync('./docker-compose.test.yml')) {
    errors.push('docker-compose.test.yml was not found at the project root');
  }

  if (!existsSync('./.env.test')) {
    errors.push('.env.test was not found at the project root');
  }

  try {
    execSync('docker --version', { stdio: 'pipe' });
  } catch {
    errors.push('Docker was not found. Install it from https://docs.docker.com/get-docker');
  }

  if (errors.length > 0) {
    console.error('\nTest prerequisites were not met:\n');
    errors.forEach(error => console.error(` - ${error}`));
    console.error('\nFix the issues above and try again.\n');
    process.exit(1);
  }

  console.log('All test prerequisites were met.\n');
}

const run = command =>
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

checkRequirements();

try {
  run('docker compose -f ./docker-compose.test.yml rm -sf ark-shop-db-test');
  run('docker compose -f ./docker-compose.test.yml up --build -d --wait');
  run('npx prisma generate');
  run('npx prisma db push --force-reset');
  run('npx jest --config ./test/jest-e2e.json --runInBand --forceExit');
} finally {
  run('docker compose -f ./docker-compose.test.yml rm -sf');
}
