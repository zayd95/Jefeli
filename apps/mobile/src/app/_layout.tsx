import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans/800ExtraBold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { useFonts } from 'expo-font';
import { describeFailure } from '@jefeli/shared';
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
    // Retrying can't fix a database that is behind the app or an expired session: fail fast and
    // show the precise screen instead of three identical failures (W1.3).
    queries: { retry: (count, err) => count < 2 && describeFailure(err).retryable, staleTime: 15_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  // Typography: DM Sans (interface) + DM Serif Display (editorial headings), only the weights used.
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
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
      {/* Reached from the recovery e-mail, signed in or not: stays open until the password is saved. */}
      <Stack.Screen name="reset-password" />
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
