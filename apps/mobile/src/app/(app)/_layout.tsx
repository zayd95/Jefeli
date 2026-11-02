import { Stack } from 'expo-router';

import { colors } from '@/design';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
      <Stack.Screen name="offer/[productId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal' }} />
      <Stack.Screen name="status/[userId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="highlight/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="live/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="live/host" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
