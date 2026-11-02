/**
 * Real live video through Stream Video (native development/production builds only).
 * This module is only `require`d after `isLiveSdkAvailable()` confirmed the WebRTC native
 * module exists, so Expo Go never evaluates it.
 */
import {
  HostLivestream,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  ViewerLivestream,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/design';

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

export function LiveVideo({ apiKey, token, user, callType, callId, role, onEnded, onError }: LiveVideoProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    let cancelled = false;
    const c = StreamVideoClient.getOrCreateInstance({ apiKey, user, token });
    const theCall = c.call(callType, callId);
    setClient(c);
    theCall
      .join({ create: false })
      .then(() => {
        if (!cancelled) setCall(theCall);
      })
      .catch((e: unknown) => onError?.(e instanceof Error ? e.message : 'join_failed'));
    return () => {
      cancelled = true;
      theCall.leave().catch(() => {});
      c.disconnectUser().catch(() => {});
    };
  }, [apiKey, token, user, callType, callId, onError]);

  if (!client || !call) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#fff" />
        <Text variant="caption" color="#fff" style={{ marginTop: 8 }}>
          Connexion au direct…
        </Text>
      </View>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        {role === 'host' ? <HostLivestream onEndStreamHandler={onEnded} /> : <ViewerLivestream onLeaveStreamHandler={onEnded} />}
      </StreamCall>
    </StreamVideo>
  );
}
