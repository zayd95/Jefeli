import { Stack } from 'expo-router';

import { colors } from '@/design';

export const unstable_settings = { anchor: 'index' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
