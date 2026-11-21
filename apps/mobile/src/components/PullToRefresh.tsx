/**
 * Pull to refresh for the web app (and the app added to the phone's home screen).
 * On the phone apps the lists already use the native `RefreshControl`; react-native-web ignores it and an
 * installed web app has no browser pull-to-refresh, so this wraps a list and listens to the touch gesture
 * itself: pull down from the very top of the list, release past the threshold, the list is fetched again.
 * On native it renders its children untouched.
 */
import { ArrowDown } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { dark, radius } from '@/design';

const THRESHOLD = 72;
const MAX_PULL = 110;

/** The nearest scrolling ancestor of `el` (stopping at `root`) is at its top. */
function atTop(el: HTMLElement | null, root: HTMLElement): boolean {
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n.scrollTop <= 0;
  }
  return true;
}

export function PullToRefresh({ onRefresh, refreshing, children }: { onRefresh: () => void | Promise<unknown>; refreshing?: boolean; children: ReactNode }) {
  const root = useRef<unknown>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onRefresh);
  useEffect(() => {
    cb.current = onRefresh;
  });
  const busyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = root.current as unknown as HTMLElement | null;
    if (!el) return;
    let startY: number | null = null;
    let dist = 0;
    const start = (e: TouchEvent) => {
      startY = !busyRef.current && e.touches.length === 1 && atTop(e.target as HTMLElement, el) ? e.touches[0]!.clientY : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0]!.clientY - startY;
      if (dy <= 0) {
        if (dist > 0) setPull((dist = 0));
        return;
      }
      if (!atTop(e.target as HTMLElement, el)) return;
      dist = Math.min(MAX_PULL, dy * 0.5);
      if (e.cancelable) e.preventDefault(); // no browser rubber-band while we show our own
      setPull(dist);
    };
    const end = () => {
      const go = startY != null && dist >= THRESHOLD;
      startY = null;
      dist = 0;
      setPull(0);
      if (!go) return;
      busyRef.current = true;
      setBusy(true);
      void Promise.resolve(cb.current()).finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  if (Platform.OS !== 'web') return <>{children}</>;
  const showing = busy || !!refreshing;
  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <View ref={root as never} style={styles.root} testID="pull-to-refresh">
      {children}
      {showing || pull > 0 ? (
        <View pointerEvents="none" style={[styles.bubbleWrap, { transform: [{ translateY: showing ? 12 : pull - 36 }] }]}>
          <View style={styles.bubble} accessibilityLiveRegion="polite" accessibilityLabel={showing ? 'Actualisation en cours' : 'Tirez pour actualiser'}>
            {showing ? <ActivityIndicator size="small" color={dark.text} /> : <ArrowDown size={18} color={dark.text} style={{ opacity: 0.4 + progress * 0.6, transform: [{ rotate: `${progress >= 1 ? 180 : 0}deg` }] }} />}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bubbleWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  bubble: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.raised, borderWidth: 1, borderColor: dark.borderStrong },
});
