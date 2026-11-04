import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BellOff, MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ProfileName } from '@/components/ProfileName';
import { Avatar, colors, EmptyState, ErrorState, Screen, Skeleton, spacing, Text } from '@/design';
import { fetchConversations } from '@/lib/api/messages';
import { useAuth } from '@/lib/auth';
import type { ConversationSummary } from '@/lib/types';

export default function Messages() {
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['conversations'], queryFn: fetchConversations, refetchInterval: 60_000 });

  return (
    <Screen>
      <View style={styles.top}>
        <Text variant="title">Messages</Text>
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.conversation_id}
        renderItem={({ item }) => <Row c={item} me={userId ?? ''} />}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.ink} />}
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Skeleton width={52} height={52} radius={26} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={13} width="45%" />
                    <Skeleton height={11} width="75%" />
                  </View>
                </View>
              ))}
            </View>
          ) : q.isError ? (
            <ErrorState message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Aucune conversation"
              body="Contactez un vendeur depuis un article, ou répondez au statut d’un ami. Vos discussions et propositions apparaîtront ici."
              actionLabel="Explorer les articles"
              onAction={() => router.push('/explore')}
            />
          )
        }
      />
    </Screen>
  );
}

function Row({ c, me }: { c: ConversationSummary; me: string }) {
  const unread = c.unread_count > 0;
  const name = c.other?.display_name ?? 'Membre';
  const mine = c.last_message_sender_id === me;
  return (
    <Pressable
      onPress={() => router.push(`/chat/${c.conversation_id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation avec ${name}${unread ? `, ${c.unread_count} non lus` : ''}`}
    >
      <Avatar path={c.other?.avatar_path} name={name} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.line}>
          {c.other ? <ProfileName profile={c.other} /> : <Text variant="bodyStrong">{name}</Text>}
          <Text variant="caption" tone={unread ? 'default' : 'secondary'} weight={unread ? '700' : '500'}>
            {timeAgo(c.last_message_at)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="callout" tone={unread ? 'default' : 'secondary'} weight={unread ? '600' : '400'} numberOfLines={1} style={{ flex: 1 }}>
            {mine ? 'Vous : ' : ''}
            {c.last_message_preview || 'Nouvelle conversation'}
          </Text>
          {c.muted ? <BellOff size={14} color={colors.textTertiary} /> : null}
          {unread ? (
            <View style={styles.badge}>
              <Text variant="micro" weight="800" color={colors.white}>
                {c.unread_count > 99 ? '99+' : c.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
