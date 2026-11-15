import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/design';
import { useLayout } from '@/lib/layout';

export const unstable_settings = { anchor: 'index' };

/**
 * Desktop web (W1.4): welcome, sign-in, sign-up and recovery keep their phone column (520 px)
 * centred on the page instead of stretching fields across a wide window. Phones: unchanged.
 */
export default function AuthLayout() {
  const { desktop } = useLayout();
  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
  if (!desktop) return stack;
  return (
    <View style={styles.page}>
      <View style={styles.column}>{stack}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 520 },
});
