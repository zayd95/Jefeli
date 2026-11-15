/** Web fallback: live video is only supported in the native apps (development builds). */
import { View } from 'react-native';

import { colors, Text } from '@/design';

export interface LiveVideoProps {
  apiKey: string;
  token: string;
  user: { id: string; name: string; image?: string };
  callType: string;
  callId: string;
  role: 'host' | 'viewer';
  onEnded?: () => void;
  onError?: (message: string) => void;
}

export function LiveVideo(_props: LiveVideoProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black, padding: 24 }}>
      <Text color={colors.white} align="center">
        La vidéo en direct est disponible dans l’application mobile.
      </Text>
    </View>
  );
}
