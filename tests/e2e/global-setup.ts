import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Before every run: make sure the DÉMO set exists and that its 24-hour statuses are fresh.
 * `seed-demo.mjs` creates the set on a fresh database, and on an existing one only recreates
 * fixture statuses that would expire during the run (timestamps relative to now, via the real
 * create_story RPC). It refuses non-local Supabase URLs unless ALLOW_DEMO_SEED=staging.
 */
export default function globalSetup() {
  const root = path.resolve(__dirname, '..', '..');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'seed-demo.mjs')], { cwd: root, stdio: 'inherit' });
}
