/**
 * Tab bar auto-hide (P2): the dock slides away while the member scrolls down a list and comes
 * back on any scroll up, at the top, and at the end of the list. Screens that own the whole
 * screen (the Reels feed inside Accueil) force it hidden. Navigation routes that are not tabs
 * (chat, Studio, composer, status viewer, Reels) never show the dock at all.
 *
 * The decision is a pure function (`nextDockHidden`, unit-tested); the store below is a tiny
 * external store read by the tab bar, so list screens only attach `useDockScroll()`.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { nextDockHidden } from '@jefeli/shared';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

let scrollHidden = false;
let forced = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setDockScrollHidden(next: boolean) {
  if (scrollHidden === next) return;
  scrollHidden = next;
  emit();
}

/** A full-screen surface (Reels) asks for the dock to stay out of the way while it is mounted. */
export function setDockForcedHidden(next: boolean) {
  if (forced === next) return;
  forced = next;
  emit();
}

export function resetDock() {
  scrollHidden = false;
  emit();
}

export function useDockHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => scrollHidden || forced,
    () => false,
  );
}

/** Attach to a list's `onScroll` (with `scrollEventThrottle`): returns the handler. */
export function useDockScroll() {
  const last = useRef(0);
  const hidden = useRef(false);
  useEffect(() => {
    return () => {
      resetDock();
    };
  }, []);
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    // Overscroll bounce above the top reads as « at the top ».
    const y = Math.max(0, contentOffset.y);
    const next = nextDockHidden(last.current, { y, contentHeight: contentSize.height, layoutHeight: layoutMeasurement.height }, hidden.current);
    last.current = y;
    hidden.current = next;
    setDockScrollHidden(next);
  }, []);
}

export const DOCK_SCROLL_PROPS = { scrollEventThrottle: 16 } as const;
