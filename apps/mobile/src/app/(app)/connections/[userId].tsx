import { toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ProfileName } from '@/components/ProfileName';
import { Avatar, Button, Chip, colors, EmptyState, ErrorState, Header, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { acceptFollowRequest, listConnections, removeFollower, type ConnectionKind } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

const LABELS: Record<ConnectionKind, string> = {
  followers: 'Abonnés',
  following: 'Abonnements',
  friends: 'Amis',
  requests: 'Demandes',
};

export default function Connections() {
  const { userId: target, kind: initial } = useLocalSearchParams<{ userId: string; kind?: ConnectionKind }>();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const isSelf = target === userId;
  const [kind, setKind] = useState<ConnectionKind>(initial ?? 'followers');
  const q = useQuery({ queryKey: ['connections', target, kind], queryFn: () => listConnections(target ?? '', kind) });
  const kinds: ConnectionKind[] = isSelf ? ['followers', 'following', 'friends', 'requests'] : ['followers', 'following', 'friends'];

  async function act(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast(ok, 'success');
      qc.invalidateQueries({ queryKey: ['connections', target] });
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  return (
    <Screen>
      <Header title={LABELS[kind]} />
      <View style={styles.chips}>
        {kinds.map((k) => (
          <Chip key={k} label={LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/u/${item.handle}`)} accessibilityRole="button">
            <Avatar path={item.avatar_path} name={item.display_name} size={46} />
            <View style={{ flex: 1 }}>
              <ProfileName profile={item} />
              <Text variant="caption" tone="secondary">
                @{item.handle}
                {item.city ? ` · ${item.city}` : ''}
              </Text>
            </View>
            {isSelf && kind === 'requests' ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button label="Accepter" size="sm" variant="cta" onPress={() => act(() => acceptFollowRequest(userId ?? '', item.id), 'Demande acceptée')} />
                <Button label="Refuser" size="sm" variant="ghost" onPress={() => act(() => removeFollower(userId ?? '', item.id), 'Demande refusée')} />
              </View>
            ) : isSelf && kind === 'followers' ? (
              <Button label="Retirer" size="sm" variant="outline" onPress={() => act(() => removeFollower(userId ?? '', item.id), 'Abonné retiré')} />
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Skeleton height={46} />
              <Skeleton height={46} />
            </View>
          ) : q.isError ? (
            <ErrorState message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon={Users} title="Personne pour l’instant" />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
});
