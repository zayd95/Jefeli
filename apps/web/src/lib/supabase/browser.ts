
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@jefeli/shared';
import { env } from '../env';

/**
 * Browser client for the moderation console. The session lives in cookies (@supabase/ssr) so a
 * server component or proxy can read it later; every permission is still enforced by the
 * database (RLS + SECURITY DEFINER RPCs that check staff roles).
 */
let client: SupabaseClient<Database> | null = null;

export function browserClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: { name: 'jefeli-admin', sameSite: 'lax', path: '/' },
  });
  return client;
}
