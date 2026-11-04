import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Skeleton, spacing, StoryRing } from '@/design';
import { fetchStoryRail } from '@/lib/api/stories';
import { useAuth } from '@/lib/auth';

/** Lovable story rail on Atlantic night: « Votre statut » first, then members with a live status. */
export function StoryRail() {
  const { userId, profile } = useAuth();
  const rail = useQuery({ queryKey: ['story-rail'], queryFn: fetchStoryRail, staleTime: 30_000 });
  const mine = rail.data?.find((r) => r.author_id === userId);
  const others = (rail.data ?? []).filter((r) => r.author_id !== userId);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <StoryRing
        tone="dark"
        path={profile?.avatar_path}
        name={profile?.display_name ?? 'Moi'}
        label={mine ? 'Mon statut' : 'Votre statut'}
        seen={false}
        addBadge={!mine}
        onPress={() => (mine ? router.push(`/statut/${userId}`) : router.push('/publish/status'))}
      />
      {rail.isPending
        ? [0, 1, 2, 3].map((i) => (
            <View key={i} style={{ alignItems: 'center', width: 66 }}>
              <Skeleton tone="dark" width={62} height={62} radius={31} />
              <Skeleton tone="dark" width={44} height={10} style={{ marginTop: 8 }} />
            </View>
          ))
        : others.map((r) =>
            r.author ? (
              <StoryRing
                tone="dark"
                key={r.author_id}
                path={r.author.avatar_path}
                name={r.author.display_name}
                label={r.author.display_name.split(' ')[0] ?? r.author.display_name}
                seen={!r.has_unseen}
                onPress={() => router.push(`/statut/${r.author_id}`)}
              />
            ) : null,
          )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: 14, paddingTop: spacing.lg, paddingBottom: spacing.sm },
});
