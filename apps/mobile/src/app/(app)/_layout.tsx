import { Stack } from 'expo-router';

import { DesktopShell } from '@/components/desktop/DesktopShell';
import { colors } from '@/design';
import { useLayout } from '@/lib/layout';

export default function AppLayout() {
  const { desktop } = useLayout();
  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
      <Stack.Screen name="offer/[productId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="report" options={{ presentation: 'modal' }} />
      <Stack.Screen name="statut/[userId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="highlight/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="live/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="live/host" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
  // Web ≥ 768 px: the same screens inside a persistent sidebar (W1.4). Phones are unchanged.
  return desktop ? <DesktopShell>{stack}</DesktopShell> : stack;
}
