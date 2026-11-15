/**
 * Phone code flow (Supabase Auth, passwordless): request a code by SMS, then verify it.
 *
 *  - sign_in: existing accounts only (`shouldCreateUser: false`)
 *  - sign_up: creates the account on the first verified code, with the chosen name
 *  - link:    adds or changes the verified number of the signed-in account (`phone_change`)
 *
 * The code is generated and checked by Supabase; nothing here decides that a code is right.
 * A request in progress survives a reload for 10 minutes (number + resend countdown).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PHONE_COUNTRY, parsePhone, retryAfterSeconds, toFrenchError, type PhoneCountry } from '@jefeli/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from './supabase';

export type PhonePurpose = 'sign_in' | 'sign_up' | 'link';

export const RESEND_SECONDS = 60;
const PENDING_TTL_MS = 10 * 60_000;
const storageKey = (purpose: PhonePurpose) => `phone-otp:${purpose}`;

interface Pending {
  e164: string;
  sentAt: number;
}

export type PhoneErrorKind = 'no_account' | 'wait' | 'other';

export function usePhoneOtp(purpose: PhonePurpose, opts: { initialPhone?: string; onVerified?: () => void } = {}) {
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [input, setInput] = useState(opts.initialPhone ?? '');
  const [step, setStep] = useState<'number' | 'code'>('number');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<{ message: string; kind: PhoneErrorKind } | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastTried = useRef('');
  const onVerified = useRef(opts.onVerified);
  useEffect(() => {
    onVerified.current = opts.onVerified;
  });

  const parsed = useMemo(() => parsePhone(input, country), [input, country]);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // Session recovery: a code requested before a reload is still waiting.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey(purpose))
      .then((raw) => {
        if (!alive || !raw) return;
        const pending = JSON.parse(raw) as Pending;
        if (Date.now() - pending.sentAt > PENDING_TTL_MS) return AsyncStorage.removeItem(storageKey(purpose));
        setInput(pending.e164);
        setSentTo(pending.e164);
        setResendAt(pending.sentAt + RESEND_SECONDS * 1000);
        setStep('code');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [purpose]);

  useEffect(() => {
    if (step !== 'code' || secondsLeft <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, secondsLeft]);

  const fail = useCallback((err: unknown) => {
    const wait = retryAfterSeconds(err);
    if (wait) setResendAt(Date.now() + wait * 1000);
    const raw = String((err as { message?: string })?.message ?? '');
    const kind: PhoneErrorKind = /signups not allowed for otp/i.test(raw) ? 'no_account' : wait ? 'wait' : 'other';
    setError({ message: kind === 'wait' ? `Patientez ${wait} s avant de demander un nouveau code.` : toFrenchError(err), kind });
  }, []);

  /** Requests a code. `captchaToken` is required when the project enables CAPTCHA. */
  const send = useCallback(
    async (extra: { displayName?: string; captchaToken?: string | null } = {}) => {
      const target = parsed.ok ? parsed.e164 : sentTo;
      if (!target || sending) return false;
      setSending(true);
      setError(null);
      try {
        const { error: err } =
          purpose === 'link'
            ? await supabase.auth.updateUser({ phone: target })
            : await supabase.auth.signInWithOtp({
                phone: target,
                options: {
                  shouldCreateUser: purpose === 'sign_up',
                  ...(purpose === 'sign_up' && extra.displayName ? { data: { display_name: extra.displayName } } : {}),
                  ...(extra.captchaToken ? { captchaToken: extra.captchaToken } : {}),
                },
              });
        if (err) throw err;
        const sentAt = Date.now();
        setSentTo(target);
        setResendAt(sentAt + RESEND_SECONDS * 1000);
        setNow(sentAt);
        setCode('');
        lastTried.current = '';
        setStep('code');
        AsyncStorage.setItem(storageKey(purpose), JSON.stringify({ e164: target, sentAt } satisfies Pending)).catch(() => {});
        return true;
      } catch (e) {
        fail(e);
        return false;
      } finally {
        setSending(false);
      }
    },
    [parsed, sentTo, sending, purpose, fail],
  );

  const verify = useCallback(
    async (value = code) => {
      const token = value.replace(/\D/g, '');
      if (!sentTo || token.length !== 6 || verifying) return false;
      lastTried.current = token;
      setVerifying(true);
      setError(null);
      try {
        const { error: err } = await supabase.auth.verifyOtp({ phone: sentTo, token, type: purpose === 'link' ? 'phone_change' : 'sms' });
        if (err) throw err;
        await AsyncStorage.removeItem(storageKey(purpose)).catch(() => {});
        onVerified.current?.();
        return true;
      } catch (e) {
        fail(e);
        return false;
      } finally {
        setVerifying(false);
      }
    },
    [code, sentTo, verifying, purpose, fail],
  );

  /** Typing the 6th digit submits once (a wrong code is not retried until it changes). */
  const changeCode = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      setCode(digits);
      if (digits.length === 6 && digits !== lastTried.current) void verify(digits);
    },
    [verify],
  );

  const changeNumber = useCallback(() => {
    setStep('number');
    setCode('');
    setError(null);
    AsyncStorage.removeItem(storageKey(purpose)).catch(() => {});
  }, [purpose]);

  return {
    country,
    setCountry,
    input,
    setInput: (v: string) => {
      setInput(v);
      if (error?.kind !== 'wait') setError(null);
    },
    parsed,
    step,
    sentTo,
    code,
    changeCode,
    send,
    verify,
    changeNumber,
    sending,
    verifying,
    error,
    secondsLeft,
  };
}
