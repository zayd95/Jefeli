import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Pilot cut (b): after sign-up / sign-in (and onboarding), take the member back to what they were
 * looking at — the article from a WhatsApp link, or the offer they wanted to make — instead of
 * dropping them on Accueil.
 *
 * Sources, in order: `?next=/offer/<id>` on the sign-in / sign-up URL (the web article page sends
 * it), then the protected URL the visitor opened before the sign-in wall. Only internal paths of
 * a short allow-list are kept (no open redirect), for at most 24 h (AsyncStorage = localStorage on
 * the web, so it survives the e-mail confirmation round trip in the same browser).
 */

const KEY = 'return-to';
/**
 * The URL the page was opened with, read when this module loads — before the router mounts and
 * the sign-in wall rewrites window.location (web). Native apps use Linking.getInitialURL().
 */
const LAUNCH_URL: string | null = typeof window !== 'undefined' && window.location?.href ? window.location.href : null;
const TTL_MS = 24 * 3_600_000;
const ALLOWED = /^\/(p|offer|u|post|chat|statut)\/[A-Za-z0-9_-]{1,64}(\?[A-Za-z0-9=&_%-]{0,200})?$|^\/explore(\?[A-Za-z0-9=&_%-]{0,200})?$/;

export function isReturnable(path: string | null | undefined): path is string {
  return !!path && ALLOWED.test(path);
}

export async function rememberReturnTo(path: string | null | undefined): Promise<void> {
  if (!isReturnable(path)) return;
  await AsyncStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })).catch(() => {});
}

export async function takeReturnTo(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    await AsyncStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path: string; at: number };
    return isReturnable(path) && Date.now() - at < TTL_MS ? path : null;
  } catch {
    return null;
  }
}

/** The path (and query) a URL points to inside the app, or null. */
export function pathOf(url: string | null): { path: string; next: string | null } | null {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const raw = parsed.path ? `/${parsed.path.replace(/^\/+/, '')}` : '/';
  const q = parsed.queryParams ?? {};
  const next = typeof q.next === 'string' ? q.next : null;
  const rest = Object.entries(q).filter(([k, v]) => k !== 'next' && typeof v === 'string');
  const query = rest.length ? `?${rest.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('&')}` : '';
  return { path: `${raw}${query}`, next };
}

/**
 * Remembers where a signed-out visitor was going, and sends them there once they are signed in
 * and onboarded. Mounted once, in the root navigator.
 */
export function useReturnTo(ready: boolean, signedIn: boolean, onboarded: boolean) {
  const captured = useRef(false);
  const inside = ready && signedIn && onboarded;

  useEffect(() => {
    if (!ready || signedIn || captured.current) return;
    captured.current = true;
    (LAUNCH_URL ? Promise.resolve(LAUNCH_URL) : Linking.getInitialURL())
      .then((url) => {
        const at = pathOf(url);
        if (!at) return;
        return rememberReturnTo(isReturnable(at.next) ? at.next : at.path);
      })
      .catch(() => {});
  }, [ready, signedIn]);

  useEffect(() => {
    if (!inside) return;
    let alive = true;
    takeReturnTo().then((path) => {
      // After the auth / onboarding stack has been swapped for the app stack (the protected
      // stack resets to the first app screen on that swap: navigate once it has settled).
      if (alive && path) setTimeout(() => alive && router.push(path as never), 450);
    });
    return () => {
      alive = false;
    };
  }, [inside]);
}
