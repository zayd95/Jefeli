import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, Screen, Text, ToastProvider, Wordmark } from '@/design';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/env';
import { registerForPush, usePushNavigation } from '@/lib/push';
import { useInboxRealtime } from '@/lib/realtime';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 15_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <RootNavigator fontsReady={fontsLoaded || !!fontError} />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, profile, initializing, profileLoading } = useAuth();
  const ready = fontsReady && !initializing && !profileLoading;
  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useInboxRealtime(signedIn ? session.user.id : null);
  usePushNavigation();

  useEffect(() => {
    if (signedIn && onboarded) registerForPush().catch(() => {});
  }, [signedIn, onboarded]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!isConfigured) return <ConfigMissing />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConfigMissing() {
  return (
    <Screen style={{ padding: 24, justifyContent: 'center', gap: 16 }}>
      <Wordmark size={36} />
      <Text variant="headline">Configuration manquante</Text>
      <Text tone="secondary">
        Définissez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans apps/mobile/.env (voir README), puis relancez
        l’application.
      </Text>
    </Screen>
  );
}
