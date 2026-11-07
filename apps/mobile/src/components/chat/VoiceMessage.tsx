import { formatDuration } from '@jefeli/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, Text } from '@/design';
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
      <Pressable onPress={toggle} style={[styles.play, mine ? { backgroundColor: colors.ink } : { backgroundColor: colors.mint }]} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Écouter le message vocal'} disabled={!uri}>
        {status.playing ? <Pause size={16} color={mine ? colors.mint : colors.night} fill={mine ? colors.mint : colors.night} /> : <Play size={16} color={mine ? colors.mint : colors.night} fill={mine ? colors.mint : colors.night} />}
      </Pressable>
      <View style={[styles.track, { backgroundColor: mine ? colors.overlay : dark.borderStrong }]}>
        <View style={[styles.fill, { width: `${Math.max(3, progress * 100)}%`, backgroundColor: mine ? colors.night : dark.mint }]} />
      </View>
      <Text variant="caption" weight="600" color={mine ? colors.inkSoft : dark.textSecondary} style={{ minWidth: 34 }}>
        {formatDuration(status.playing || status.currentTime > 0 ? status.currentTime * 1000 : total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
