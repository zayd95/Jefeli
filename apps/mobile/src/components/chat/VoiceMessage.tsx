import { formatDuration } from '@jefeli/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, Text } from '@/design';
import { useMediaUrl } from '@/lib/media';

export function VoiceMessage({ path, durationMs, mine }: { path: string; durationMs?: number; mine: boolean }) {
  const uri = useMediaUrl('private-media', path);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const total = (status.duration ? status.duration * 1000 : 0) || durationMs || 0;
  const progress = total > 0 ? Math.min(1, (status.currentTime * 1000) / total) : 0;

  function toggle() {
    if (!uri) return;
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (total > 0 && status.currentTime * 1000 >= total - 50)) player.seekTo(0);
      player.play();
    }
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} style={[styles.play, mine && { backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Écouter le message vocal'} disabled={!uri}>
        {status.playing ? <Pause size={16} color={mine ? colors.action : colors.white} fill={mine ? colors.action : colors.white} /> : <Play size={16} color={mine ? colors.action : colors.white} fill={mine ? colors.action : colors.white} />}
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(3, progress * 100)}%` }]} />
      </View>
      <Text variant="caption" weight="600" tone="secondary" style={{ minWidth: 34 }}>
        {formatDuration(status.playing || status.currentTime > 0 ? status.currentTime * 1000 : total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(16,37,44,0.15)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.ink },
});
