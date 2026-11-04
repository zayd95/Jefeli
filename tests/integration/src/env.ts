// Connection settings for the LOCAL Supabase stack. The default keys are the well-known
// public demo keys that every `supabase start` prints; they are not secrets.

const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? DEFAULT_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? DEFAULT_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_SERVICE_ROLE_KEY;
export const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL ?? DEFAULT_DB_URL;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Throws unless `url` points at this machine. These tests create and delete users. */
export function assertLocal(url: string, what: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`[integration-tests] ${what} is not a valid URL: ${url}`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `[integration-tests] Refusing to run: ${what} (${host}) is not localhost/127.0.0.1. ` +
        'These tests create and delete users and must only ever run against a local Supabase stack.',
    );
  }
}

assertLocal(SUPABASE_URL, 'SUPABASE_URL');
assertLocal(SUPABASE_DB_URL, 'SUPABASE_DB_URL');
