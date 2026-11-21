import { NOTIFICATION_COPY, timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Clapperboard, ShieldAlert, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { PullToRefresh } from '@/components/PullToRefresh';

import { Avatar, Button, colors, EmptyState, ErrorState, Header, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { fetchStoriesByIds } from '@/lib/api/stories';
import { keepStoryAsReel } from '@/lib/reels';
import { fetchNotifications, markAllNotificationsRead, type NotificationItem } from '@/lib/api/notifications';
import { incomingFriendRequests } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

function targetFor(n: NotificationItem): string | null {
  // Pilot cut (c): every offer / deal notification opens its chat (the offer card and the
  // agreement are both reached from there).
  const chat = typeof n.data?.conversation_id === 'string' ? n.data.conversation_id : null;
  if (chat && (n.entity_type === 'offer' || n.entity_type === 'agreement')) return `/chat/${chat}`;
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

/** « Le garder en Reel ? »: one tap turns the expired video status into a permanent Reel. */
function KeepAsReel({ storyId }: { storyId: string }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  useEffect(() => {
    void AsyncStorage.getItem(`reel-kept:${storyId}`).then((v) => v && setState('done'));
  }, [storyId]);
  async function keep() {
    setState('busy');
    try {
      const [story] = await fetchStoriesByIds([storyId]);
      if (!story) throw new Error('story_gone');
      await keepStoryAsReel(story);
      await AsyncStorage.setItem(`reel-kept:${storyId}`, '1').catch(() => {});
      setState('done');
      toast('Gardé en Reel', 'success');
    } catch (e) {
      setState('idle');
      toast(e instanceof Error && e.message === 'story_gone' ? 'Cette vidéo n’est plus disponible.' : toFrenchError(e), 'error');
    }
  }
  return (
    <Button
      label={state === 'done' ? 'Gardé en Reel' : 'Garder en Reel'}
      variant="outline"
      size="sm"
      icon={Clapperboard}
      loading={state === 'busy'}
      disabled={state === 'done'}
      onPress={() => void keep()}
      style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
      testID="keep-as-reel"
    />
  );
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
      <PullToRefresh onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
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
                {item.type === 'reel_candidate' && item.entity_id ? <KeepAsReel storyId={item.entity_id} /> : null}
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
      </PullToRefresh>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  unread: { backgroundColor: colors.raised },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  systemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  requests: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, margin: spacing.lg, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
