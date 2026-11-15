import { NOTIFICATION_COPY, timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, ShieldAlert, UserPlus } from 'lucide-react-native';
import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, colors, EmptyState, ErrorState, Header, Screen, Skeleton, spacing, Text } from '@/design';
import { fetchNotifications, markAllNotificationsRead, type NotificationItem } from '@/lib/api/notifications';
import { incomingFriendRequests } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

function targetFor(n: NotificationItem): string | null {
  switch (n.entity_type) {
    case 'post':
      return `/post/${n.entity_id}`;
    case 'profile':
      return n.actor ? `/u/${n.actor.handle}` : null;
    case 'conversation':
      return `/chat/${n.entity_id}`;
    case 'offer':
      return null;
    case 'agreement':
      return `/agreement/${n.entity_id}`;
    case 'live_session':
      return `/live/${n.entity_id}`;
    case 'story':
      return n.actor ? `/statut/${n.actor.id}` : null;
    case 'friend_request':
      return '/friends';
    case 'moderation_action':
    case 'appeal':
      return '/settings/moderation';
    case 'verification_request':
      return '/settings/verification';
    case 'review':
      return '/(tabs)/profile';
    default:
      return null;
  }
}

export default function Notifications() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(userId ?? '') });
  const requests = useQuery({ queryKey: ['friend-requests'], queryFn: () => incomingFriendRequests(userId ?? '') });

  useEffect(() => {
    if (!q.data?.some((n) => !n.read_at)) return;
    const t = setTimeout(() => {
      markAllNotificationsRead()
        .then(() => qc.invalidateQueries({ queryKey: ['unread-notifications'] }))
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [q.data, qc]);

  return (
    <Screen>
      <Header title="Notifications" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.ink} />}
        ListHeaderComponent={
          (requests.data ?? []).length > 0 ? (
            <Pressable style={styles.requests} onPress={() => router.push('/friends')} accessibilityRole="button">
              <UserPlus size={20} color={colors.ink} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {requests.data!.length} demande{requests.data!.length > 1 ? 's' : ''} d’ami
              </Text>
              <Text variant="callout" weight="700">
                Voir →
              </Text>
            </Pressable>
          ) : undefined
        }
        renderItem={({ item }) => {
          const actorName = item.actor?.display_name ?? 'Jëfëli';
          const copy = NOTIFICATION_COPY[item.type]?.(actorName, item.data ?? {}) ?? item.type;
          const href = targetFor(item);
          const system = !item.actor;
          return (
            <Pressable
              onPress={() => href && router.push(href as never)}
              disabled={!href}
              style={({ pressed }) => [styles.row, !item.read_at && styles.unread, pressed && { backgroundColor: colors.surfaceSubtle }]}
              accessibilityRole={href ? 'button' : undefined}
            >
              {system ? (
                <View style={styles.systemIcon}>
                  <ShieldAlert size={20} color={colors.ink} />
                </View>
              ) : (
                <Avatar path={item.actor?.avatar_path} name={actorName} size={44} />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight={item.read_at ? '400' : '600'}>
                  {copy}
                </Text>
                <Text variant="caption" tone="secondary">
                  {timeAgo(item.created_at)}
                </Text>
              </View>
              {!item.read_at ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
            </View>
          ) : q.isError ? (
            <ErrorState message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon={Bell} title="Rien de nouveau" body="Abonnements, commentaires et propositions apparaîtront ici." />
          )
        }
        ListFooterComponent={
          (q.data ?? []).length > 0 ? (
            <Button label="Réglages des notifications" variant="ghost" size="sm" onPress={() => router.push('/settings/privacy')} style={{ margin: spacing.lg }} />
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  unread: { backgroundColor: '#EEF7F3' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accentDeep },
  systemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  requests: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, margin: spacing.lg, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
