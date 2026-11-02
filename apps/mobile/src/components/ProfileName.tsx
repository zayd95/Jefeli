import { StyleSheet, View } from 'react-native';

import { DemoBadge, Text, VerifiedBadge, type AppTextProps } from '@/design';
import type { ProfileLite } from '@/lib/types';

/** Display name + verified badge (only if truly merchant_verified) + DÉMO marker. */
export function ProfileName({
  profile,
  variant = 'bodyStrong',
  numberOfLines = 1,
}: {
  profile: Pick<ProfileLite, 'display_name' | 'verification_level' | 'is_demo'>;
  variant?: AppTextProps['variant'];
  numberOfLines?: number;
}) {
  return (
    <View style={styles.row}>
      <Text variant={variant} weight="700" numberOfLines={numberOfLines} style={{ flexShrink: 1 }}>
        {profile.display_name}
      </Text>
      {profile.verification_level === 'merchant_verified' ? <VerifiedBadge size={variant === 'title' ? 20 : 15} /> : null}
      {profile.is_demo ? <DemoBadge /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
});
