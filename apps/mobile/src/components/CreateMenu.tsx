/**
 * The « + » (W1.3): three cards fan out above the button, which becomes ×. Each card is a small
 * picture of what it creates: Statut · Publication · Article. Publication sits in the middle, right
 * above the +, so « + » then a tap on the same spot publishes. Nothing else on screen: no quick
 * starts, no second selector.
 *
 * Drafts are explicit: a card whose draft exists carries a « BROUILLON » badge, and tapping it asks
 * « Continuer le brouillon » or « Nouvelle … » (which confirms before deleting). A draft is never
 * replaced silently.
 *
 * The feed stays recognizable behind a soft scrim. Cards are small-angle (±5°), side by side with no
 * overlap, at least 44 pt everywhere. Narrow phones (< 360 pt), large text and screen readers get
 * the same choices as a list. Closes with ×, a tap outside, Android back or Escape. Reduced motion:
 * no animation.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Clock3, PenSquare, Tag, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, PixelRatio, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, dark, radius, shadow, spacing, Text } from '@/design';
import { DOCK_GAP, DOCK_HEIGHT } from '@/lib/dock';
import { discardDraft, readDraftSummary, type DraftKind } from '@/lib/drafts';

import { DraftChoice } from './DraftChoice';

/** Kept for callers of the W1.2 helper. */
export { describePostDraft } from '@/lib/drafts';

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => alive && setReduce(r));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // react-native-web cannot detect a screen reader and always answers true; the cards are
    // labelled buttons anyway, so on the web only the width decides.
    if (Platform.OS === 'web') return undefined;
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((r) => alive && setOn(r));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

type Key = 'status' | 'post' | 'listing';
const CHOICES: { key: Key; label: string; sub: string; a11y: string; icon: LucideIcon; route: string; draft?: DraftKind }[] = [
  { key: 'status', label: 'Statut', sub: '24 heures', a11y: 'Statut : photo, vidéo ou voix pendant 24 heures', icon: Clock3, route: '/publish/status' },
  { key: 'post', label: 'Publication', sub: 'photos · voix · texte', a11y: 'Publication : photos, voix et texte', icon: PenSquare, route: '/publish/post', draft: 'post' },
  { key: 'listing', label: 'Article', sub: 'vente ou troc', a11y: 'Article : un objet à vendre ou à troquer', icon: Tag, route: '/publish/listing', draft: 'listing' },
];

async function readDrafts(): Promise<Record<DraftKind, string | null>> {
  const [post, listing] = await Promise.all([readDraftSummary('post'), readDraftSummary('listing')]);
  return { post, listing };
}

export function CreateMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const screenReader = useScreenReader();
  // On the web PixelRatio.getFontScale() is the device pixel ratio, not a text-size setting.
  const largeText = Platform.OS !== 'web' && PixelRatio.getFontScale() >= 1.3;
  const asList = width < 360 || largeText || screenReader;
  const [anim] = useState(() => new Animated.Value(0));
  const [asking, setAsking] = useState<DraftKind | null>(null);

  const drafts = useQuery({ queryKey: ['create-menu-drafts'], queryFn: readDrafts, enabled: visible, staleTime: 0, gcTime: 0 });

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    anim.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, reduce, anim]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (asking) setAsking(null);
      else close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, onClose, asking]);

  function close() {
    setAsking(null);
    onClose();
  }

  function go(route: string) {
    close();
    router.push(route as never);
  }

  function choose(c: (typeof CHOICES)[number]) {
    if (c.draft && drafts.data?.[c.draft]) {
      setAsking(c.draft);
      return;
    }
    go(c.route);
  }

  const routeOf = (kind: DraftKind) => (kind === 'post' ? '/publish/post' : '/publish/listing');
  const choice = asking ? (
    <DraftChoice
      kind={asking}
      tone="dark"
      summary={drafts.data?.[asking] ?? ''}
      onContinue={() => go(`${routeOf(asking)}?draft=continue`)}
      onNew={async () => {
        await discardDraft(asking);
        qc.removeQueries({ queryKey: ['create-menu-drafts'] });
        go(`${routeOf(asking)}?draft=new`);
      }}
      onDismiss={() => setAsking(null)}
    />
  ) : null;

  const dockCenter = Math.max(insets.bottom, DOCK_GAP) + DOCK_HEIGHT / 2;
  // 104 + 124 + 104 + two 10-pt gaps = 352 pt: scale down a little below 376 pt, keeping at least
  // 12 pt each side so the tilted side cards never touch the screen edge (sub-pixel rounding).
  const scale = Math.min(1, (width - 24) / 352);
  const fade = { opacity: anim };
  const rise = (dy: number, deg: number) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
      { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${deg}deg`] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8 * scale, scale] }) },
    ],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => (asking ? setAsking(null) : close())} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, fade]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Fermer le menu de création" />
      </Animated.View>

      {asList ? (
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
          <Text variant="headline" weight="800" tone="fog" accessibilityRole="header">
            Créer
          </Text>
          {choice ??
            CHOICES.map((c) => {
              const draft = c.draft ? drafts.data?.[c.draft] : null;
              return (
                <Pressable key={c.key} onPress={() => choose(c)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={draft ? `${c.a11y}. Brouillon en cours` : c.a11y}>
                  <View style={styles.rowIcon}>
                    <c.icon size={20} color={colors.night} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyStrong" tone="fog">
                      {c.label}
                    </Text>
                    <Text variant="caption" tone="fogSecondary" numberOfLines={2}>
                      {draft ? `Brouillon : ${draft}` : c.sub}
                    </Text>
                  </View>
                  {draft ? <DraftBadge /> : null}
                </Pressable>
              );
            })}
          {!asking ? (
            <Pressable onPress={close} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Fermer">
              <View style={[styles.rowIcon, { backgroundColor: dark.subtle }]}>
                <X size={20} color={dark.text} />
              </View>
              <Text variant="bodyStrong" tone="fog">
                Fermer
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.anchor]} accessibilityViewIsModal>
          <View pointerEvents="box-none" style={{ alignItems: 'center', paddingBottom: dockCenter - 28, width: '100%' }}>
            {choice ? (
              <Animated.View style={[styles.choiceWrap, fade]}>{choice}</Animated.View>
            ) : (
              <View style={styles.fan} pointerEvents="box-none">
                {CHOICES.map((c) => {
                  const center = c.key === 'post';
                  const deg = c.key === 'status' ? -5 : c.key === 'listing' ? 5 : 0;
                  const draft = c.draft ? drafts.data?.[c.draft] : null;
                  return (
                    <Animated.View key={c.key} style={[center ? styles.cardSlotCenter : styles.cardSlot, rise(center ? 70 : 50, deg)]}>
                      <Pressable
                        onPress={() => choose(c)}
                        style={({ pressed }) => [styles.card, center ? styles.cardCenter : styles.cardSide, shadow.floating, pressed && { transform: [{ scale: 0.96 }] }]}
                        accessibilityRole="button"
                        accessibilityLabel={draft ? `${c.a11y}. Brouillon en cours : ${draft}` : c.a11y}
                        testID={`create-${c.key}`}
                      >
                        <CardPicture kind={c.key} />
                        <View style={{ gap: 1 }}>
                          <Text weight="800" color={center ? colors.night : colors.ink} style={{ fontSize: center ? 16 : 15, lineHeight: 20 }}>
                            {c.label}
                          </Text>
                          <Text weight="600" color={center ? colors.inkSoft : colors.textSecondary} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
                            {c.sub}
                          </Text>
                        </View>
                        {draft ? (
                          <View style={styles.badgeSlot} pointerEvents="none">
                            <DraftBadge />
                          </View>
                        ) : null}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}

            <Pressable
              onPress={() => (asking ? setAsking(null) : close())}
              style={({ pressed }) => [styles.close, shadow.floating, pressed && { transform: [{ scale: 0.94 }] }]}
              accessibilityRole="button"
              accessibilityLabel={asking ? 'Retour aux choix' : 'Fermer'}
            >
              <X size={26} color={colors.night} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

function DraftBadge() {
  return (
    <View style={styles.badge}>
      <Text weight="800" color={colors.ink} style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.3 }}>
        BROUILLON
      </Text>
    </View>
  );
}

/** A small picture of what each card creates (decorative). */
function CardPicture({ kind }: { kind: Key }) {
  if (kind === 'status') {
    return (
      <View style={styles.picStatus} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.picStatusBars}>
          <View style={[styles.picStatusBar, { backgroundColor: colors.mint }]} />
          <View style={[styles.picStatusBar, { backgroundColor: dark.borderStrong }]} />
        </View>
        <View style={styles.picStatusDot} />
      </View>
    );
  }
  if (kind === 'post') {
    return (
      <View style={styles.picPost} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.picPostGarment} />
        <View style={styles.picPostBar}>
          <View style={styles.picPostPlay} />
          {[5, 9, 6, 10, 4, 8, 5].map((h, i) => (
            <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i < 4 ? colors.mint : dark.textSecondary }} />
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.picTag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.picTagHole} />
      <Text weight="800" color={colors.mint} style={{ fontSize: 12, lineHeight: 15 }}>
        25 000 F
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Softer than W1.2: the feed stays recognizable behind the cards.
  scrim: { backgroundColor: dark.scrimSoft },
  pressed: { opacity: 0.85 },
  anchor: { justifyContent: 'flex-end', alignItems: 'center' },
  fan: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 22 },
  cardSlot: { width: 104 },
  cardSlotCenter: { width: 124, marginBottom: 26 },
  card: { borderRadius: 22, padding: 12, gap: 8, alignItems: 'flex-start' },
  cardSide: { height: 146, backgroundColor: dark.text },
  cardCenter: { height: 172, borderRadius: 26, padding: 13, backgroundColor: colors.mint },
  badgeSlot: { position: 'absolute', top: -10, right: -6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.gold },
  choiceWrap: { width: '100%', paddingHorizontal: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
  close: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  // List (narrow phones, large text, screen readers)
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: dark.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: 6, borderRadius: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  // Card pictures
  picStatus: { width: 48, height: 70, borderRadius: 10, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  picStatusBars: { position: 'absolute', top: 6, left: 6, right: 6, flexDirection: 'row', gap: 3 },
  picStatusBar: { flex: 1, height: 2, borderRadius: 1 },
  picStatusDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold },
  picPost: { width: 98, height: 74, borderRadius: 12, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center' },
  picPostGarment: { width: 34, height: 46, marginTop: 8, borderRadius: 6, backgroundColor: colors.surfaceMuted },
  picPostBar: { position: 'absolute', left: 6, right: 6, bottom: 6, height: 16, borderRadius: 8, backgroundColor: dark.glass, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  picPostPlay: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint, marginRight: 3 },
  picTag: { width: 80, height: 50, marginVertical: 10, borderRadius: radius.md, backgroundColor: colors.forest, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  picTagHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: dark.text },
});
