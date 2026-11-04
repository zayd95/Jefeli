import { toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { UserX } from 'lucide-react-native';

import { ProfileView } from '@/components/ProfileView';
import { EmptyState, ErrorState, Header, Screen, Skeleton, spacing } from '@/design';
import { getProfileByHandle } from '@/lib/api/profiles';

export default function UserProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const q = useQuery({ queryKey: ['profile', handle], queryFn: () => getProfileByHandle(handle ?? '') });

  if (q.isPending) {
    return (
      <Screen>
        <Header />
        <Skeleton height={120} radius={14} style={{ margin: spacing.sm }} />
        <Skeleton height={22} width="45%" style={{ marginHorizontal: spacing.lg, marginTop: 56 }} />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <Header />
        <ErrorState message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  if (!q.data) {
    return (
      <Screen>
        <Header />
        <EmptyState icon={UserX} title="Profil indisponible" body="Ce compte n’existe pas, a été suspendu, ou n’est pas visible pour vous." />
      </Screen>
    );
  }
  return <ProfileView profile={q.data} />;
}
