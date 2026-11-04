import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Compass, House, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing, Text } from '@/design';
import { fetchUnreadCount } from '@/lib/api/messages';
import { useAuth } from '@/lib/auth';

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
 * One five-item Tinder-inspired navigation dock, ported from the approved
 * Lovable layout. The center Plus enters the post composer directly; article
 * and status are accessible in its compact switcher, never through a giant hub.
 *
 * iOS safe areas, unread counters and accessible French labels are preserved.
 */
function JefeliTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const { userId } = useAuth();
  const unread = useQuery({
    queryKey: ['unread-messages'],
    queryFn: fetchUnreadCount,
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const activeName = state.routes[state.index]?.name;
  const dark = activeName === 'index' || activeName === 'profile';

  return (
    <View style={[styles.bar, { backgroundColor: dark ? colors.darkBackground : colors.background, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.dock, dark ? styles.dockDark : styles.dockLight]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const selected = state.index === index && route.name !== 'publish';
          const Icon = meta.icon;
          const unreadCount = route.name === 'messages' ? (unread.data ?? 0) : 0;
          const ink = selected ? colors.ink : dark ? colors.darkText : colors.textSecondary;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={unreadCount ? meta.label + ', ' + unreadCount + ' non lus' : meta.label}
              onPress={() => {
                if (route.name === 'publish') router.push('/publish/post');
                else navigateToTab(route.key);
              }}
              style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.itemPressed]}
            >
              <View style={styles.iconWrap}>
                <Icon size={route.name === 'publish' ? 25 : 22} color={ink} strokeWidth={selected ? 2.5 : 2} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text variant="micro" weight="700" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="micro" weight={selected ? '700' : '600'} color={ink} numberOfLines={1}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <JefeliTabBar {...(props as unknown as TabBarProps)} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="publish" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    paddingHorizontal: 5,
    borderRadius: 38,
    borderWidth: 1,
  },
  dockLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: colors.border,
  },
  dockDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(247,246,243,0.22)',
  },
  item: {
    flex: 1,
    minWidth: 0,
    height: 58,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  itemSelected: { backgroundColor: colors.action },
  itemPressed: { opacity: 0.78 },
  iconWrap: { height: 26, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
