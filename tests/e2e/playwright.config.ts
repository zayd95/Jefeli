import { defineConfig } from '@playwright/test';

/**
 * Prerequisites (see README): local Supabase running, Edge Functions served, the Expo web
 * build on :8081 (`pnpm --filter @jefeli/mobile web`) and the Next.js app on :3000
 * (`pnpm web`). Demo seed (`node scripts/seed-demo.mjs`) is needed for the admin account
 * and the screen tour.
 */
export default defineConfig({
  testDir: './specs',
  // Seeds the DÉMO set if absent and refreshes its 24-hour statuses (local stacks only).
  globalSetup: './global-setup.ts',
  timeout: 12 * 60 * 1000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: process.env.APP_URL ?? 'http://localhost:8081',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // A fake microphone (a test tone) for voice recording (W1.2). Access is still granted per
    // context (newDevice({ mic: true })), so a refused permission stays testable.
    launchOptions: { args: ['--use-fake-device-for-media-stream'] },
  },
});
