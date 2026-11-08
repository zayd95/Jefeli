/**
 * Recoverable failures (W1.3). A request that fails must leave people with a way forward and give
 * support enough to find the cause: a precise French title, a retry when retrying can help, and a
 * short block of diagnostics they can copy. Nothing secret goes in it (no token, no key, no user id).
 */
import { describeFailure, type Failure } from '@jefeli/shared';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { env } from './env';

export interface Diagnosed {
  failure: Failure;
  /** Plain text, one fact per line, safe to paste in a WhatsApp message to support. */
  details: string;
}

function rawMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message ?? '');
  return String(err);
}

const logged = new WeakSet<object>();

export function diagnose(err: unknown, where: string, at = new Date()): Diagnosed {
  const failure = describeFailure(err);
  const message = rawMessage(err).replace(/\s+/g, ' ').trim().slice(0, 200);
  const details = [
    `Code : ${failure.code}`,
    `Écran : ${where}`,
    `Heure : ${at.toISOString()}`,
    `Version : ${env.appEnv} · ${Platform.OS}`,
    message ? `Message : ${message}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  // One structured line per failure, for the browser console / device logs. In development
  // console.error would open the LogBox over the screen being diagnosed.
  if (typeof err === 'object' && err !== null && !logged.has(err)) {
    logged.add(err);
    (__DEV__ ? console.log : console.error)('[jefeli] request failed', { where, kind: failure.kind, code: failure.code, message });
  }
  return { failure, details };
}

/** Stable for a given error object, so the timestamp doesn't change on every render. */
export function useDiagnosed(err: unknown, where: string): Diagnosed | null {
  return useMemo(() => (err ? diagnose(err, where) : null), [err, where]);
}
