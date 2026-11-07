/**
 * Public, non-secret configuration. NEXT_PUBLIC_* values are inlined at build time, so each
 * variable must be referenced literally. Never add secrets here (no service-role key).
 */
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
// Well-known anon key of the local Supabase stack (`supabase start`). Only used as a fallback
// when the URL points at the local stack, so `pnpm web` works out of the box in development.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export type AppEnv = 'local' | 'staging' | 'production';

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);
}

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL).replace(/\/+$/, '');
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isLocalUrl(supabaseUrl) ? LOCAL_ANON_KEY : '');

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY manquant\u00A0: voir apps/web/.env.example');
}

const rawEnv = process.env.NEXT_PUBLIC_ENV;
const appEnv: AppEnv = rawEnv === 'production' || rawEnv === 'staging' ? rawEnv : 'local';

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  /** The mobile web app (Expo web build). When set, « open in Jëfëli » buttons go there instead of the native app. */
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, ''),
  appEnv,
  isProduction: appEnv === 'production',
} as const;
