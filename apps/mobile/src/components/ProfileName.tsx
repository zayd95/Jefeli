import { StyleSheet, View } from 'react-native';

import { DemoBadge, Text, VerifiedBadge, type AppTextProps } from '@/design';
import type { ProfileLite } from '@/lib/types';

/** Display name + verified badge (only if truly merchant_verified) + DÉMO marker. */
export function ProfileName({
  profile,
  variant = 'bodyStrong',
  numberOfLines = 1,
  tone = 'light',
  serif,
}: {
  profile: Pick<ProfileLite, 'display_name' | 'verification_level' | 'is_demo'>;
  variant?: AppTextProps['variant'];
  numberOfLines?: number;
  /** dark = fog text on Atlantic night (Home, Profile, Messages). */
  tone?: 'light' | 'dark';
  serif?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant={variant} weight={serif ? '600' : '700'} serif={serif} tone={tone === 'dark' ? 'fog' : 'default'} numberOfLines={numberOfLines} style={{ flexShrink: 1 }}>
        {profile.display_name}
      </Text>
      {profile.verification_level === 'merchant_verified' ? <VerifiedBadge size={variant === 'title' ? 20 : 15} /> : null}
      {profile.is_demo ? <DemoBadge tone={tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
});
