/**
 * Cloudflare Turnstile (free CAPTCHA supported by Supabase Auth) on the web app.
 *
 * Shown only when EXPO_PUBLIC_TURNSTILE_SITE_KEY is set; the matching secret lives in the
 * Supabase Auth settings (never in the app). Each token is single-use: call `reset()` after
 * every auth request. Native apps need a WebView version before CAPTCHA can be switched on
 * for them (docs/PHONE_AUTH.md).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Text } from '@/design';
import { env } from '@/lib/env';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('captcha_script'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface CaptchaState {
  /** True when the project requires a token before sign-in / sign-up / code requests. */
  required: boolean;
  token: string | null;
  failed: boolean;
  reset: () => void;
  element: React.ReactNode;
}

export function useCaptcha(): CaptchaState {
  const required = Platform.OS === 'web' && !!env.turnstileSiteKey;
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // react-native-web renders a <div>; the native ref type does not describe it.
  const host = useRef<HTMLElement | null>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!required) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const el = host.current;
        if (cancelled || !el || !window.turnstile) return;
        widget.current = window.turnstile.render(el, {
          sitekey: env.turnstileSiteKey,
          language: 'fr',
          appearance: 'interaction-only',
          callback: (t: string) => {
            setToken(t);
            setFailed(false);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [required]);

  const reset = useCallback(() => {
    setToken(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  const element = required ? (
    <View style={{ gap: 4 }}>
      <View ref={host as never} />
      {failed ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          La vérification anti-robot n’a pas pu se charger. Vérifiez votre connexion puis rechargez la page.
        </Text>
      ) : null}
    </View>
  ) : null;

  return { required, token, failed, reset, element };
}
