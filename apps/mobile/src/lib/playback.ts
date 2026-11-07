/**
 * One audible source at a time, across the whole app: feed videos (W1.1), voice publications,
 * photo narrations, voice statuses and chat voice notes (W1.2). A player claims the slot to play
 * and pauses as soon as another one claims it. Everything is released when the app goes to the
 * background or the browser tab is hidden.
 */
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

let playingKey: string | null = null;
const listeners = new Set<() => void>();

export function setPlaying(key: string | null) {
  if (playingKey === key) return;
  playingKey = key;
  listeners.forEach((l) => l());
}

export function subscribePlaying(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getPlaying() {
  return playingKey;
}

/** Release the slot (the current player pauses). */
export function pauseAll() {
  setPlaying(null);
}

/** Whether `key` currently holds the slot. */
export function useIsPlaying(key: string): boolean {
  return useSyncExternalStore(subscribePlaying, getPlaying, getPlaying) === key;
}

if (Platform.OS === 'web') {
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.hidden && setPlaying(null));
} else {
  AppState.addEventListener('change', (state) => state !== 'active' && setPlaying(null));
}
