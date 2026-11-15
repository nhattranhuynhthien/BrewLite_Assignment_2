import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.E2E_WEB_URL ||
  process.env.E2E_BASE_URL ||
  'http://127.0.0.1:3000';
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    channel,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
