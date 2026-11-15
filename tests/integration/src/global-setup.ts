import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

// Runs once before all files: refuses non-local targets (env.ts throws on import) and fails
// fast with a clear message when the local stack is not running.
export default async function globalSetup(): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `[integration-tests] Local Supabase is not reachable at ${SUPABASE_URL} (${String(err)}). ` +
        'Start it with `pnpm db:start` (and apply migrations) before running the suite.',
    );
  }
}
