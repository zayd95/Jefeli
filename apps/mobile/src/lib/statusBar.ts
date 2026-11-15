import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Light status-bar icons while an Atlantic-night screen (Home, Profile, Messages, statuses) is
 * focused; dark icons again when it loses focus. React Navigation emits blur before focus, so
 * the next screen always wins. Near-white screens rely on the root default (« dark »).
 */
export function useDarkStatusBar() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return undefined;
      StatusBar.setStyle('light', true);
      return () => StatusBar.setStyle('dark', true);
    }, []),
  );
}
