import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the production demo build, served the way
 * Firebase Hosting serves it (SPA fallback, service worker enabled).
 *
 * `PLAYWRIGHT_CHROMIUM_EXECUTABLE` lets environments with a preinstalled
 * Chromium skip `npx playwright install`.
 */
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] || undefined;
const port = 4300;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `npx ng build --configuration production && node e2e/serve.mjs dist/peaches/browser ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
});
