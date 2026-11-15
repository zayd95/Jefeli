/**
 * Password recovery from the e-mail link. Supabase Auth verifies the link, then sends the member
 * back to /reset-password with the recovery session in the URL fragment
 * (#access_token=…&refresh_token=…&type=recovery), or with #error_code=… when the link expired or
 * was already used.
 */
import * as Linking from 'expo-linking';

export const RESET_PASSWORD_PATH = '/reset-password';

/**
 * Where the e-mail link brings the member back: jefeli://reset-password in an installed build,
 * exp://…/--/reset-password in Expo Go, the app's own origin on the web. The hosted Supabase
 * project must allow it (Auth → URL Configuration), see docs/SETUP_PRODUCTION.md.
 */
export function resetPasswordRedirectUrl(): string {
  return Linking.createURL(RESET_PASSWORD_PATH);
}

/** Where the sign-up confirmation link brings the member back (same per-runtime rules as above). */
export function confirmEmailRedirectUrl(): string {
  return Linking.createURL('/sign-in');
}

export type RecoveryLink = { kind: 'session'; accessToken: string; refreshToken: string } | { kind: 'invalid' };

/** Reads a recovery callback URL. Null when the URL carries no auth callback at all. */
export function parseRecoveryLink(url: string | null | undefined): RecoveryLink | null {
  if (!url) return null;
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const params = new URLSearchParams(hashAt >= 0 ? url.slice(hashAt + 1) : '');
  if (queryAt >= 0) {
    // Supabase Auth may report errors in the query string instead of the fragment.
    new URLSearchParams(url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined)).forEach((v, k) => {
      if (!params.has(k)) params.set(k, v);
    });
  }
  if (params.has('error') || params.has('error_code') || params.has('error_description')) return { kind: 'invalid' };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken && !refreshToken) return null;
  // Only a recovery link may open the « new password » form (not a sign-up confirmation).
  if (!accessToken || !refreshToken || params.get('type') !== 'recovery') return { kind: 'invalid' };
  return { kind: 'session', accessToken, refreshToken };
}
