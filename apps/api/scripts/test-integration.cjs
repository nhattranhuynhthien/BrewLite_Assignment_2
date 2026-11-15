const { spawnSync } = require('node:child_process');

const value = process.env.TEST_DATABASE_URL;
if (!value || !/test/i.test(new URL(value).pathname)) {
  throw new Error(
    'TEST_DATABASE_URL must target a dedicated test database (name containing "test")',
  );
}

const env = {
  ...process.env,
  DATABASE_URL: value,
  NODE_ENV: 'test',
  JWT_SECRET:
    process.env.JWT_SECRET ||
    'integration_test_secret_at_least_32_characters_long',
};

for (const [file, args] of [
  [require.resolve('prisma/build/index.js'), ['migrate', 'deploy']],
  [
    require.resolve('jest/bin/jest'),
    ['--config', 'jest-e2e.config.cjs', '--runInBand'],
  ],
]) {
  const result = spawnSync(process.execPath, [file, ...args], {
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
