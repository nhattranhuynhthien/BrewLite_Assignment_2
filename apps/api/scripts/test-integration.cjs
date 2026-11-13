const { spawnSync } = require('node:child_process');
const path = require('node:path');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error('TEST_DATABASE_URL is required for integration tests.');
  process.exit(1);
}

let databaseName;
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
} catch {
  console.error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  process.exit(1);
}
if (!/test/i.test(databaseName)) {
  console.error('Refusing to migrate a database whose name does not contain "test".');
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: process.env.JWT_SECRET ?? 'integration_test_secret_at_least_32_chars',
};

function run(entryPoint, args) {
  const result = spawnSync(process.execPath, [require.resolve(entryPoint), ...args], {
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js'), [
  'migrate',
  'deploy',
]);
run(path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js'), [
  '--config',
  'jest-e2e.config.cjs',
  '--runInBand',
]);
