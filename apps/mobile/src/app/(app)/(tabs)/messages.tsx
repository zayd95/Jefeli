/**
 * Messages, ported from the approved Lovable inbox (Atlantic night): serif header, a short
 * editorial line, a glass search over the loaded conversations, then « DISCUSSIONS ». Rows keep
 * the native unread counts, mute state, « Vous : » prefix and realtime refresh.
 */
import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BellOff, ChevronRight, MessageCircle, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ProfileName } from '@/components/ProfileName';
import { Avatar, colors, dark, EmptyState, ErrorState, fieldFontSize, fonts, Screen, Skeleton, spacing, Text, WEB_NO_OUTLINE } from '@/design';
import { fetchConversations } from '@/lib/api/messages';
import { useAuth } from '@/lib/auth';
import { useDockSpace } from '@/lib/dock';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { ConversationSummary } from '@/lib/types';

export default function Messages() {
  useDarkStatusBar();
  const { userId } = useAuth();
  const dockSpace = useDockSpace();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['conversations'], queryFn: fetchConversations, refetchInterval: 60_000 });
  const all = useMemo(() => q.data ?? [], [q.data]);
  // Local filter on conversations already loaded for this member (no extra query, no new data).
  const needle = search.trim().toLowerCase();
  const rows = useMemo(
    () => (needle ? all.filter((c) => `${c.other?.display_name ?? ''} ${c.other?.handle ?? ''}`.toLowerCase().includes(needle)) : all),
    [all, needle],
  );

  return (
    <Screen background={dark.background}>
      <View style={styles.head}>
        <Text serif weight="600" tone="fog" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>
          Messages
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.conversation_id}
        renderItem={({ item }) => <Row c={item} me={userId ?? ''} />}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={dark.text} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: dockSpace }}
        ListHeaderComponent={
          <View style={styles.intro}>
            {all.length > 0 ? (
              <View style={styles.search}>
                <Search size={20} color={dark.mint} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher une conversation"
                  placeholderTextColor={dark.textTertiary}
                  selectionColor={dark.mint}
                  accessibilityLabel="Rechercher une conversation"
                  autoCorrect={false}
                  style={[styles.searchInput, WEB_NO_OUTLINE]}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ padding: spacing.lg, gap: spacing.lg }} accessibilityLabel="Chargement">
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Skeleton tone="dark" width={56} height={56} radius={28} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton tone="dark" height={13} width="45%" />
                    <Skeleton tone="dark" height={11} width="75%" />
                  </View>
                </View>
              ))}
            </View>
          ) : q.isError ? (
            <ErrorState tone="dark" message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
          ) : needle ? (
            <Text variant="callout" tone="fogSecondary" align="center" style={{ padding: spacing.xl }}>
              Aucune conversation pour « {search.trim()} ».
            </Text>
          ) : (
            <EmptyState
              tone="dark"
              icon={MessageCircle}
              title="Aucune conversation"
              body="Écrivez à un vendeur depuis un article : vos discussions apparaîtront ici."
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
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark.subtle }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation avec ${name}${unread ? `, ${c.unread_count} non lus` : ''}`}
    >
      <Avatar path={c.other?.avatar_path} name={name} size={56} />
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <View style={styles.line}>
          {c.other ? <ProfileName profile={c.other} tone="dark" /> : <Text variant="bodyStrong" tone="fog">{name}</Text>}
          <Text variant="caption" color={unread ? dark.mint : dark.textTertiary} weight={unread ? '700' : '500'} style={{ fontSize: 12 }}>
            {timeAgo(c.last_message_at)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="callout" color={unread ? dark.text : dark.textSecondary} weight={unread ? '600' : '400'} numberOfLines={1} style={{ flex: 1 }}>
            {mine ? 'Vous : ' : ''}
            {c.last_message_preview || 'Nouvelle conversation'}
          </Text>
          {c.muted ? <BellOff size={14} color={dark.textTertiary} /> : null}
          {unread ? (
            <View style={styles.badge}>
              <Text variant="micro" weight="800" color={colors.night}>
                {c.unread_count > 99 ? '99+' : c.unread_count}
              </Text>
            </View>
          ) : (
            <ChevronRight size={16} color={dark.mint} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { minHeight: 62, justifyContent: 'center', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: dark.border },
  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 48, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: fieldFontSize(14), color: dark.text, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 85, marginHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: dark.border },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
