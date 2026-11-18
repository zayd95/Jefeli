import { defineConfig } from '@playwright/test';

/**
 * Family preview journey (17 Nov): a brand-new person on the hosted preview, 390 px phone viewport.
 *   APP_URL=https://jefeli.vercel.app SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx playwright test -c playwright.family.config.ts
 * The preview is public (no Vercel login). In a sandbox whose browsers must go through a proxy,
 * HTTPS_PROXY is used for every request.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: /family-journey\.spec\.ts/,
  timeout: 10 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/family-results.json' }]],
  use: {
    baseURL: process.env.APP_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream'],
      ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
    },
  },
});
