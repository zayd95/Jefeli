import { defineConfig } from '@playwright/test';

/**
 * Hosted acceptance (W1.3): the Vercel preview of the branch against jefeli-staging. No DÉMO
 * seeding (staging is a shared project), only `hosted.spec.ts`. Run with:
 *   APP_URL=<app preview> WEB_URL=<web preview> HOSTED_COOKIES=<Vercel access cookies, JSON>
 *   HOSTED_ACCOUNTS=<json file with two test accounts> npx playwright test -c playwright.hosted.config.ts
 * In a sandbox whose browsers must go through a proxy, HTTPS_PROXY is used for every request.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: /hosted\.spec\.ts/,
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/hosted-results.json' }]],
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
