import { formatDuration } from '@jefeli/shared';
import { Pause, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, Text } from '@/design';
import { useMediaUrl } from '@/lib/media';

import { useVoicePlayer, Waveform } from '../audio/Voice';

/**
 * A chat voice note (W1.2): shares the app-wide playback slot (never over a video or another
 * voice), shows the waveform recorded with it, and plays at 1×, 1.5× or 2×. Private bucket: the
 * signed URL is readable only by the two members of the conversation.
 */
export function VoiceMessage({ path, durationMs, waveform, mine }: { path: string; durationMs?: number; waveform?: number[] | null; mine: boolean }) {
  const uri = useMediaUrl('private-media', path);
  const v = useVoicePlayer(uri, durationMs ?? null);
  const fg = dark.gold;
  return (
    <View style={styles.row}>
      <Pressable onPress={v.toggle} style={[styles.play, { backgroundColor: colors.gold }]} accessibilityRole="button" accessibilityLabel={v.playing ? 'Pause' : 'Écouter le message vocal'} disabled={!uri}>
        {v.playing ? <Pause size={16} color={colors.onPrimary} fill={colors.onPrimary} /> : <Play size={16} color={colors.onPrimary} fill={colors.onPrimary} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Waveform values={waveform} progress={v.progress} height={24} bars={28} color={dark.borderStrong} activeColor={fg} onSeek={v.seek} />
      </View>
      <Text variant="caption" weight="600" color={dark.textSecondary} style={{ minWidth: 34 }}>
        {formatDuration(v.playing || v.positionMs > 0 ? v.positionMs : v.totalMs)}
      </Text>
      {v.playing ? (
        <Pressable onPress={v.cycleRate} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Vitesse ${v.rate} fois. Changer`}>
          <Text variant="micro" weight="800" color={dark.textSecondary}>
            {v.rate === 1 ? '1×' : v.rate === 1.5 ? '1,5×' : '2×'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
