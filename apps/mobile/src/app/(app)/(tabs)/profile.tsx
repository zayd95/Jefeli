import { ProfileView } from '@/components/ProfileView';
import { dark, Screen, Skeleton, spacing } from '@/design';
import { useAuth } from '@/lib/auth';

export default function MyProfile() {
  const { profile } = useAuth();
  if (!profile) {
    return (
      <Screen background={dark.background} style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton tone="dark" height={120} radius={14} />
        <Skeleton tone="dark" height={20} width="50%" />
      </Screen>
    );
  }
  return <ProfileView profile={profile} isOwnTab />;
}
