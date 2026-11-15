/**
 * Public, non-secret configuration. Anything secret belongs in Supabase Edge Function
 * secrets — never in EXPO_PUBLIC_* variables (they are embedded in the app bundle).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  supabaseUrl: url.replace(/\/+$/, ''),
  supabaseKey: key,
  webBaseUrl: (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  appEnv: (process.env.EXPO_PUBLIC_ENV ?? 'local') as 'local' | 'staging' | 'production',
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '',
  /** Cloudflare Turnstile site key (public). Empty = no CAPTCHA widget (local development). */
  turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
export const isProduction = env.appEnv === 'production';
