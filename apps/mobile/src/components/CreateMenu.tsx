/**
 * The smart « + » (W1.2). The feed stays visible behind an ink scrim; three choices fan out from
 * the button: Statut · Publication · Article. Publication sits right above the +, so « + » then a
 * tap on the same spot publishes. « Commencer par » quick starts open the composer already
 * listening, or with one of your articles to present, and « Reprendre » appears only when a real
 * draft exists, saying what it holds.
 *
 * Small phones (< 360 pt), large text and screen readers get the same choices as a plain sheet.
 * Closes with ×, a tap outside, Android back or Escape. Reduced motion: no animation.
 */
import { formatDuration } from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Clock3, FileText, Mic, PenSquare, ShoppingBag, Tag, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, PixelRatio, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, dark, shadow, spacing, Text } from '@/design';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { DOCK_GAP, DOCK_HEIGHT } from '@/lib/dock';

type Draft = { route: '/publish/post' | '/publish/listing'; summary: string };

/** What a saved draft holds, in a few words (« 4 photos · voix 0:42 »). Null when it is empty. */
export function describePostDraft(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { body?: string; media?: { kind?: string }[]; voice?: { durationMs?: number } | null; productIds?: string[] };
    const parts: string[] = [];
    const photos = (d.media ?? []).filter((m) => m.kind !== 'video').length;
    const videos = (d.media ?? []).filter((m) => m.kind === 'video').length;
    if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
    if (videos) parts.push(`${videos} vidéo${videos > 1 ? 's' : ''}`);
    if (d.voice?.durationMs) parts.push(`voix ${formatDuration(d.voice.durationMs)}`);
    if (d.productIds?.length) parts.push(`${d.productIds.length} article${d.productIds.length > 1 ? 's' : ''}`);
    const text = (d.body ?? '').trim();
    if (parts.length === 0 && !text) return null;
    if (parts.length === 0) return `« ${text.length > 28 ? `${text.slice(0, 27)}…` : text} »`;
    return parts.join(' · ');
  } catch {
    return null;
  }
}

async function readDraft(): Promise<Draft | null> {
  const post = describePostDraft(await AsyncStorage.getItem('draft:post'));
  if (post) return { route: '/publish/post', summary: post };
  try {
    const listing = JSON.parse((await AsyncStorage.getItem('draft:listing')) ?? 'null') as { title?: string; media?: unknown[] } | null;
    const title = listing?.title?.trim();
    if (title || listing?.media?.length) return { route: '/publish/listing', summary: title ? `Article « ${title.length > 24 ? `${title.slice(0, 23)}…` : title} »` : 'Article en cours' };
  } catch {
    /* no listing draft */
  }
  return null;
}

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
    // react-native-web cannot detect a screen reader and always answers true; the arc's buttons
    // are labelled anyway, so on the web only the width decides.
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

const CHOICES: { key: 'status' | 'post' | 'listing'; label: string; hint: string; icon: LucideIcon; route: string }[] = [
  { key: 'status', label: 'Statut', hint: 'Photo, vidéo ou voix. Disparaît après 24 heures.', icon: Clock3, route: '/publish/status' },
  { key: 'post', label: 'Publication', hint: 'Photos, vidéo, voix et articles. Reste sur votre profil.', icon: PenSquare, route: '/publish/post' },
  { key: 'listing', label: 'Article', hint: 'Mettre un objet en vente ou en troc.', icon: Tag, route: '/publish/listing' },
];

export function CreateMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const reduce = useReducedMotion();
  const screenReader = useScreenReader();
  // On the web PixelRatio.getFontScale() is the device pixel ratio, not a text-size setting.
  const largeText = Platform.OS !== 'web' && PixelRatio.getFontScale() >= 1.3;
  const asSheet = width < 360 || largeText || screenReader;
  const [anim] = useState(() => new Animated.Value(0));

  const draft = useQuery({ queryKey: ['create-menu-draft'], queryFn: readDraft, enabled: visible, staleTime: 0, gcTime: 0 });
  const products = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: visible && !!userId });
  const hasProducts = (products.data ?? []).length > 0;

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
    anim.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, reduce, anim]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  function go(route: string) {
    onClose();
    router.push(route as never);
  }

  const quick: { key: string; label: string; icon: LucideIcon; route: string; a11y: string }[] = [
    { key: 'voice', label: 'Ma voix', icon: Mic, route: '/publish/post?start=voice', a11y: 'Commencer par ma voix : publication vocale ou explication' },
    ...(hasProducts
      ? [
          {
            key: 'present',
            label: 'Présenter un article',
            icon: ShoppingBag,
            // One article: nothing to choose, straight to the recorder with it attached.
            route: products.data!.length === 1 ? `/publish/post?product=${products.data![0]!.id}` : '/publish/post?start=present',
            a11y: 'Présenter un de mes articles, en photos et en voix',
          },
        ]
      : []),
  ];

  const dockCenter = Math.max(insets.bottom, DOCK_GAP) + DOCK_HEIGHT / 2;
  const fade = { opacity: anim };
  const rise = (dy: number) => ({ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, fade]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le menu de création" />
      </Animated.View>

      {asSheet ? (
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
          <Text variant="headline" weight="800" tone="fog" accessibilityRole="header">
            Créer
          </Text>
          {draft.data ? <SheetRow icon={FileText} label="Reprendre le brouillon" a11y={`Reprendre le brouillon : ${draft.data.summary}`} hint={draft.data.summary} onPress={() => go(draft.data!.route)} /> : null}
          {CHOICES.map((c) => (
            <SheetRow key={c.key} icon={c.icon} label={c.label} hint={c.hint} onPress={() => go(c.route)} />
          ))}
          {quick.map((q) => (
            <SheetRow key={q.key} icon={q.icon} label={q.label} a11y={q.a11y} hint={q.key === 'voice' ? 'Enregistrez, puis ajoutez photos ou articles.' : 'Choisissez un article, présentez-le en voix.'} onPress={() => go(q.route)} />
          ))}
          <SheetRow icon={X} label="Fermer" onPress={onClose} />
        </View>
      ) : (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center' }]} accessibilityViewIsModal>
          <View pointerEvents="box-none" style={{ alignItems: 'center', paddingBottom: dockCenter - 28 }}>
            {draft.data ? (
              <Animated.View style={rise(30)}>
                <Pressable onPress={() => go(draft.data!.route)} style={({ pressed }) => [styles.draft, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Reprendre le brouillon : ${draft.data.summary}`}>
                  <FileText size={16} color={dark.mint} />
                  <Text variant="callout" weight="700" tone="fog">
                    Reprendre
                  </Text>
                  <Text variant="caption" tone="fogSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {draft.data.summary}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}

            <Animated.View style={[styles.quickRow, rise(24)]}>
              <Text variant="micro" weight="700" tone="fogSecondary" style={{ letterSpacing: 0.6 }}>
                COMMENCER PAR
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {quick.map((q) => (
                  <Pressable key={q.key} onPress={() => go(q.route)} style={({ pressed }) => [styles.quick, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={q.a11y}>
                    <q.icon size={16} color={colors.night} />
                    <Text variant="callout" weight="700" color={colors.night}>
                      {q.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* The arc: Publication right above the +, Statut and Article on each side. */}
            <View style={styles.arc} pointerEvents="box-none">
              {CHOICES.map((c) => {
                const center = c.key === 'post';
                return (
                  <Animated.View key={c.key} style={[styles.choiceWrap, center ? styles.choiceCenter : styles.choiceSide, rise(center ? 60 : 40)]}>
                    <Pressable onPress={() => go(c.route)} style={({ pressed }) => [styles.choice, center && styles.choiceMain, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityRole="button" accessibilityLabel={c.label} accessibilityHint={c.hint}>
                      <c.icon size={center ? 28 : 24} color={colors.night} strokeWidth={2.1} />
                    </Pressable>
                    <View style={styles.choiceLabel} pointerEvents="none">
                      <Text variant="callout" weight="700" tone="fog">
                        {c.label}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            <Pressable onPress={onClose} style={({ pressed }) => [styles.close, shadow.floating, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityRole="button" accessibilityLabel="Fermer">
              <X size={26} color={colors.night} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

function SheetRow({ icon: Icon, label, a11y, hint, onPress }: { icon: LucideIcon; label: string; a11y?: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityHint={hint}>
      <View style={styles.rowIcon}>
        <Icon size={20} color={colors.night} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" tone="fog">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="fogSecondary" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: dark.scrim },
  pressed: { opacity: 0.85 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 340, paddingHorizontal: 16, height: 44, borderRadius: 22, backgroundColor: dark.subtle, borderWidth: 1, borderColor: dark.mintLine, marginBottom: spacing.lg },
  quickRow: { alignItems: 'center', gap: 8, marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: colors.mintSoft },
  arc: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 22, marginBottom: 18 },
  choiceWrap: { alignItems: 'center', gap: 8, width: 96 },
  choiceCenter: { marginBottom: 34 },
  choiceSide: { marginBottom: 0 },
  choice: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  choiceMain: { width: 70, height: 70, borderRadius: 35 },
  choiceLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: dark.glass },
  close: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: dark.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: 6, borderRadius: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
});
