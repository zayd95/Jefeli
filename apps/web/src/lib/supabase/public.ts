import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@jefeli/shared';
import { env } from '../env';

/**
 * Anonymous, session-less client for public share pages (server components). It only ever
 * sees what Row Level Security returns to anonymous visitors.
 */
let client: SupabaseClient<Database> | null = null;

export function publicClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
