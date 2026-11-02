import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleDashed } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { StoryViewer } from '@/components/StoryViewer';
import { Button, colors, EmptyState, Screen, spacing } from '@/design';
import { getProfile } from '@/lib/api/profiles';
import { fetchActiveStories } from '@/lib/api/stories';

export default function StatusScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const stories = useQuery({ queryKey: ['active-stories', userId], queryFn: () => fetchActiveStories(userId ?? '') });
  const author = useQuery({ queryKey: ['profile-by-id', userId], queryFn: () => getProfile(userId ?? '') });

  if (stories.isPending || author.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!stories.data?.length) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState icon={CircleDashed} title="Aucun statut visible" body="Les statuts disparaissent après 24 heures, ou ne sont pas partagés avec vous." />
        <Button label="Fermer" variant="outline" onPress={() => router.back()} style={{ margin: spacing.xl }} />
      </Screen>
    );
  }
  return <StoryViewer stories={stories.data} author={author.data ?? null} />;
}
