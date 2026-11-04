import { ProfileView } from '@/components/ProfileView';
import { Screen, Skeleton, spacing } from '@/design';
import { useAuth } from '@/lib/auth';

export default function MyProfile() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <Screen style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} radius={14} />
        <Skeleton height={20} width="50%" />
      </Screen>
    );
  }
  return <ProfileView profile={profile} isOwnTab />;
}
