import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Compass, House, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, dark, shadow, Text } from '@/design';
import { fetchUnreadCount } from '@/lib/api/messages';
import { useAuth } from '@/lib/auth';
import { DOCK_GAP, DOCK_HEIGHT } from '@/lib/dock';
import { STUDIO } from '@/lib/studioLinks';
import { resetDock, useDockHidden } from '@/lib/dockVisibility';
import { useLayout } from '@/lib/layout';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Accueil', icon: House },
  explore: { label: 'Explorer', icon: Compass },
  publish: { label: 'Publier', icon: Plus },
  messages: { label: 'Messages', icon: MessageCircle },
  profile: { label: 'Profil', icon: UserRound },
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
  insets: { bottom: number };
};

/**
 * One five-item floating dock, ported from the approved Lovable shell: a rounded glass bar
 * that floats over the content, labels always visible, the active tab a mint pill. It is dark
 * on Atlantic-night tabs (Accueil, Messages, Profil) and near-white on Explorer.
 *
 * « Publier » opens the smart creation menu (W1.2): Statut · Publication · Article, voice and
 * « présenter un article » quick starts, and « Reprendre » when a draft exists. iOS safe areas, unread counters and French accessible labels are kept. On Android the dock
 * hides while the keyboard is open so it never rides above it.
 */
function JefeliTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const { userId } = useAuth();
  const unread = useQuery({
    queryKey: ['unread-messages'],
    queryFn: fetchUnreadCount,
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const reduceMotion = useReducedMotion();
  // Hidden by scroll (or by a full-screen surface). With reduced motion the dock stays put.
  const hiddenByScroll = useDockHidden() && !reduceMotion;
  const slide = useSharedValue(0);
  const travel = DOCK_HEIGHT + Math.max(insets.bottom, DOCK_GAP) + 8;
  useEffect(() => {
    // Under 250 ms: a duration-bound spring (Reanimated 4) with a slight overshoot.
    slide.value = withSpring(hiddenByScroll ? 1 : 0, { duration: 220, dampingRatio: 0.85 });
  }, [hiddenByScroll, slide]);
  // Changing tab always shows the dock again.
  useEffect(() => {
    resetDock();
  }, [state.index]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value * travel }] }));
  if (keyboard) return null;


  return (
    <Animated.View
      pointerEvents={hiddenByScroll ? 'none' : 'box-none'}
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, DOCK_GAP) }, slideStyle]}
      aria-hidden={hiddenByScroll}
    >
      <View style={[styles.dock, styles.dockDark, shadow.floating]} accessibilityRole="tablist" aria-label="Navigation principale">
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const selected = state.index === index && route.name !== 'publish';
          const Icon = meta.icon;
          const unreadCount = route.name === 'messages' ? (unread.data ?? 0) : 0;
          const isPublish = route.name === 'publish';
          // Active destination: Senegalese gold on a deeper green; others: muted green-grey.
          const ink = selected ? colors.gold : dark.textSecondary;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              accessibilityLabel={unreadCount ? meta.label + ', ' + unreadCount + ' non lus' : meta.label}
              accessibilityHint={route.name === 'publish' ? 'Ouvre le Studio : photo, vidéo, voix ou texte' : undefined}
              onPress={() => {
                if (route.name === 'publish') router.push(STUDIO.open);
                else navigateToTab(route.key);
              }}
              style={({ pressed }) => [
                styles.item,
                selected && styles.itemSelected,
                pressed && !selected && !isPublish && styles.pressedDark,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <View style={isPublish ? styles.publish : styles.iconWrap}>
                <Icon size={isPublish ? 22 : 21} color={isPublish ? colors.onPrimary : ink} strokeWidth={isPublish ? 2.4 : 1.9} />
                {unreadCount > 0 && (
                  <View style={[styles.badge, { borderColor: colors.night }]}>
                    <Text variant="micro" weight="700" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="micro" weight="600" color={isPublish ? dark.textStrong : ink} numberOfLines={1} style={styles.label}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { desktop } = useLayout();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.darkBackground } }}
      // Desktop web: the sidebar replaces the dock (DesktopShell).
      tabBar={(props) => (desktop ? null : <JefeliTabBar {...(props as unknown as TabBarProps)} />)}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" options={{ sceneStyle: { backgroundColor: dark.background } }} />
      <Tabs.Screen name="publish" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Floats over the scene (Lovable `absolute inset-x-0 bottom-0 px-3`); screens pad with useDockSpace().
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 5,
    borderRadius: 23,
    borderWidth: 1,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  dockDark: { backgroundColor: dark.dock, borderColor: dark.dockBorder },
  item: {
    flex: 1,
    minWidth: 0,
    height: 62,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  itemSelected: { backgroundColor: dark.raised },
  pressedDark: { backgroundColor: dark.subtle },
  iconWrap: { height: 22, alignItems: 'center', justifyContent: 'center' },
  // « Publier »: a small gold action button raised above the dock, ringed with the page colour.
  publish: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginTop: -22,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, lineHeight: 12, paddingHorizontal: 2 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
