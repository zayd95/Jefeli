import { afterAll } from 'vitest';
import { cleanupCreatedData } from './helpers';

// Runs in every test file: after the file, close realtime sockets and delete the users and
// files it created (set KEEP_TEST_DATA=1 to keep them for debugging).
afterAll(async () => {
  await cleanupCreatedData();
});
