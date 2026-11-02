import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Compass, House, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, Text } from '@/design';
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

function JefeliTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const { userId } = useAuth();
  const unread = useQuery({
    queryKey: ['unread-messages'],
    queryFn: fetchUnreadCount,
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const Icon = meta.icon;
        if (route.name === 'publish') {
          return (
            <Pressable
              key={route.key}
              onPress={() => router.push('/publish')}
              accessibilityRole="button"
              accessibilityLabel="Publier : publication, statut, article ou live"
              style={styles.item}
            >
              <View style={styles.create}>
                <Plus size={24} color={colors.action} strokeWidth={2.6} />
              </View>
              <Text variant="micro" weight="600" tone="secondary" style={styles.label}>
                {meta.label}
              </Text>
            </Pressable>
          );
        }
        const badge = route.name === 'messages' ? (unread.data ?? 0) : 0;
        return (
          <Pressable
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${meta.label}, ${badge} non lus` : meta.label}
            style={styles.item}
          >
            <View>
              <Icon size={23} color={focused ? colors.ink : colors.textSecondary} strokeWidth={focused ? 2.4 : 1.9} />
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text variant="micro" weight="800" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="micro" weight={focused ? '700' : '500'} color={focused ? colors.ink : colors.textSecondary} style={styles.label}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
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
    backgroundColor: '#FFFEFC',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 50, gap: 3 },
  label: { fontSize: 10.5 },
  create: {
    width: 44,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFEFC',
  },
});
