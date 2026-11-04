import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

/**
 * True only in native builds that include the WebRTC module (EAS development/production
 * builds). Expo Go and the web preview return false, and Live stays disabled there.
 */
export function isLiveSdkAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!(NativeModules.WebRTCModule ?? TurboModuleRegistry.get('WebRTCModule'));
  } catch {
    return false;
  }
}
