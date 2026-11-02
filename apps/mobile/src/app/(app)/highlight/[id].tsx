import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleDashed } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { StoryViewer } from '@/components/StoryViewer';
import { Button, colors, EmptyState, Screen, spacing } from '@/design';
import { getProfile } from '@/lib/api/profiles';
import { supabase, unwrap } from '@/lib/supabase';
import type { StoryRow } from '@/lib/types';

async function fetchHighlight(id: string): Promise<{ owner_id: string; stories: StoryRow[] } | null> {
  const row = unwrap(
    await supabase.from('highlights').select('owner_id, items:highlight_items(position, story:stories(*))').eq('id', id).maybeSingle(),
  ) as unknown as { owner_id: string; items: { position: number; story: StoryRow | null }[] } | null;
  if (!row) return null;
  const stories = [...row.items].sort((a, b) => a.position - b.position).map((i) => i.story).filter((s): s is StoryRow => !!s);
  return { owner_id: row.owner_id, stories };
}

export default function HighlightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useQuery({ queryKey: ['highlight', id], queryFn: () => fetchHighlight(id ?? '') });
  const owner = useQuery({ queryKey: ['profile-by-id', h.data?.owner_id], queryFn: () => getProfile(h.data?.owner_id as string), enabled: !!h.data?.owner_id });

  if (h.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!h.data?.stories.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState icon={CircleDashed} title="Sélection vide" body="Ces statuts ne sont plus disponibles ou ne vous sont pas partagés." />
        <Button label="Fermer" variant="outline" onPress={() => router.back()} style={{ margin: spacing.xl }} />
      </Screen>
    );
  }
  return <StoryViewer stories={h.data.stories} author={owner.data ?? null} isHighlight />;
}
