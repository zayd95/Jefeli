import { defineConfig } from 'vitest/config';

// Integration tests hit a real (local) Supabase stack. They share one database, so files
// run one after another and every test creates its own fresh users.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/global-setup.ts'],
    setupFiles: ['./src/setup-file.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false, shuffle: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    teardownTimeout: 60_000,
    reporters: ['default'],
  },
});
