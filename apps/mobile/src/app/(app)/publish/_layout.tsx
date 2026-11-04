import { Stack } from 'expo-router';

import { colors } from '@/design';

export default function PublishLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
