/**
 * Push notifications (Expo). Requires a development/production build with an EAS
 * projectId; in Expo Go / web / simulators it degrades silently (in-app notifications
 * keep working through Realtime).
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { env } from './env';
import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

function projectId(): string | null {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return env.easProjectId || fromConfig || null;
}

export type PushRegistration = 'registered' | 'denied' | 'unavailable';

export async function registerForPush(): Promise<PushRegistration> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  const id = projectId();
  if (!id) return 'unavailable';
  if (Constants.executionEnvironment === 'storeClient' && Platform.OS === 'android') return 'unavailable';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Jëfëli',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return 'denied';

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) return 'unavailable';
  return 'registered';
}

/** Deep-link from a tapped notification to the right screen. */
export function usePushNavigation() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    });
    return () => sub.remove();
  }, []);
}
