import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Compass, House, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing, Text } from '@/design';
import { fetchUnreadCount } from '@/lib/api/messages';
import { useAuth } from '@/lib/auth';

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
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
 * Floating pill navigation (owner's UI reference): the active tab is a soft mint pill with its
 * label, the others are icons (each keeps its French accessibility label), and « Publier » is a
 * separate round button so creating content is always one tap away.
 */
function JefeliTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const { userId } = useAuth();
  const unread = useQuery({
    queryKey: ['unread-messages'],
    queryFn: fetchUnreadCount,
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.pill} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const meta = TAB_META[route.name];
          if (!meta || route.name === 'publish') return null;
          const focused = state.index === i;
          const Icon = meta.icon;
          const badge = route.name === 'messages' ? (unread.data ?? 0) : 0;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigateToTab(route.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              aria-selected={focused}
              accessibilityLabel={badge ? `${meta.label}, ${badge} non lus` : meta.label}
              style={({ pressed }) => [styles.item, focused && styles.itemOn, pressed && !focused && { opacity: 0.6 }]}
            >
              <View>
                <Icon size={22} color={focused ? colors.ink : colors.textSecondary} strokeWidth={focused ? 2.4 : 2} />
                {badge > 0 ? (
                  <View style={styles.badge}>
                    <Text variant="micro" weight="700" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              {focused ? (
                <Text variant="callout" weight="700" numberOfLines={1}>
                  {meta.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => router.push('/publish')}
        accessibilityRole="button"
        accessibilityLabel="Publier : publication, statut, article ou live"
        style={({ pressed }) => [styles.create, pressed && { backgroundColor: colors.inkSoft }]}
      >
        <Plus size={26} color={colors.action} strokeWidth={2.6} />
      </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  item: { minWidth: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  itemOn: { backgroundColor: colors.mintSoft, paddingHorizontal: spacing.lg },
  create: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
