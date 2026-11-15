/**
 * Voice playback (W1.2): voice publications, photo narrations, voice statuses and the recorder's
 * preview. Every player shares the app-wide playback slot (@/lib/playback), so a voice never
 * plays over a video or another voice. Nothing is downloaded before the member presses play, and
 * nothing ever starts with sound by itself.
 */
import { formatDuration, voiceLanguageLabel } from '@jefeli/shared';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Mic, Pause, Play } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { colors, dark, Text } from '@/design';
import { getPlaying, setPlaying, useIsPlaying } from '@/lib/playback';

const RATES = [1, 1.5, 2] as const;

/**
 * A voice player bound to the shared slot. The source is loaded on the first press, inside the
 * press itself: nothing is downloaded for voices nobody plays (data costs), and Safari accepts
 * audible playback only when play() runs in the gesture.
 */
export function useVoicePlayer(uri: string | null | undefined, durationMs: number | null | undefined, opts: { active?: boolean } = {}) {
  const key = useId();
  const playing = useIsPlaying(key);
  const [armed, setArmed] = useState(false);
  const loaded = useRef<string | null>(null);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const totalMs = (status.duration ? status.duration * 1000 : 0) || durationMs || 0;
  const positionMs = Math.min(totalMs || Infinity, (status.currentTime ?? 0) * 1000);
  const finished = status.didJustFinish || (totalMs > 0 && positionMs >= totalMs - 80 && !status.playing);

  // Another player took the slot (or the app went to the background): pause.
  useEffect(() => {
    if (armed && !playing) player.pause();
  }, [armed, playing, player]);
  // The end of the voice frees the slot (the next press starts again from the beginning).
  useEffect(() => {
    if (status.didJustFinish && getPlaying() === key) setPlaying(null);
  }, [status.didJustFinish, key]);
  // Feed: a card that scrolls away stops talking.
  useEffect(() => {
    if (opts.active === false && getPlaying() === key) setPlaying(null);
  }, [opts.active, key]);
  useEffect(() => () => {
    if (getPlaying() === key) setPlaying(null);
  }, [key]);

  function toggle() {
    if (!uri) return;
    if (playing) {
      setPlaying(null);
      player.pause();
      return;
    }
    if (loaded.current !== uri) {
      player.replace({ uri });
      loaded.current = uri;
      if (rate !== 1) player.setPlaybackRate(rate);
      setArmed(true);
    } else if (finished) {
      player.seekTo(0);
    }
    setPlaying(key);
    player.play();
  }
  function seek(fraction: number) {
    if (!armed || totalMs <= 0) return;
    player.seekTo((Math.max(0, Math.min(1, fraction)) * totalMs) / 1000);
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;
    setRate(next);
    if (armed) player.setPlaybackRate(next);
  }
  return {
    playing,
    loading: playing && armed && !status.isLoaded,
    positionMs: armed ? positionMs : 0,
    totalMs,
    progress: totalMs > 0 && armed ? Math.min(1, positionMs / totalMs) : 0,
    rate,
    toggle,
    seek,
    cycleRate,
  };
}

/** Waveform bars (values 0–100). Tapping seeks when `onSeek` is given. */
export function Waveform({
  values,
  progress,
  height = 32,
  color,
  activeColor,
  onSeek,
  bars = 40,
}: {
  values?: number[] | null;
  progress: number;
  height?: number;
  color: string;
  activeColor: string;
  onSeek?: (fraction: number) => void;
  bars?: number;
}) {
  const width = useRef(0);
  const shape = resample(values, bars);
  const content = (
    <View style={[styles.wave, { height }]} onLayout={(e: LayoutChangeEvent) => (width.current = e.nativeEvent.layout.width)}>
      {shape.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, (v / 100) * height),
            borderRadius: 2,
            backgroundColor: (i + 0.5) / shape.length <= progress ? activeColor : color,
          }}
        />
      ))}
    </View>
  );
  if (!onSeek) return content;
  return (
    <Pressable
      onPress={(e: GestureResponderEvent) => width.current > 0 && onSeek(e.nativeEvent.locationX / width.current)}
      accessibilityRole="adjustable"
      accessibilityLabel="Position dans l’enregistrement"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onSeek(Math.max(0, Math.min(1, progress + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
    >
      {content}
    </Pressable>
  );
}

/** Downsample (max per bucket) or, without data, a calm flat line (never a fake shape). */
export function resample(values: number[] | null | undefined, bars: number): number[] {
  if (!values || values.length === 0) return Array.from({ length: bars }, () => 18);
  return Array.from({ length: bars }, (_, i) => {
    const start = Math.floor((i * values.length) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / bars));
    let max = 0;
    for (let j = start; j < end && j < values.length; j++) max = Math.max(max, values[j] ?? 0);
    return Math.max(8, max);
  });
}

function PlayButton({ playing, loading, onPress, size, label, tone }: { playing: boolean; loading: boolean; onPress: () => void; size: number; label: string; tone: 'mint' | 'glass' | 'ink' }) {
  const bg = tone === 'mint' ? colors.mint : tone === 'ink' ? colors.ink : dark.glass;
  const fg = tone === 'mint' ? colors.night : tone === 'ink' ? colors.mint : colors.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.95 }] }]}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Mettre en pause' : label}
      hitSlop={6}
    >
      {loading ? <ActivityIndicator color={fg} /> : playing ? <Pause size={size * 0.38} color={fg} fill={fg} /> : <Play size={size * 0.38} color={fg} fill={fg} style={{ marginLeft: size * 0.05 }} />}
    </Pressable>
  );
}

function RateButton({ rate, onPress, light }: { rate: number; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.rate, light && styles.rateLight]} accessibilityRole="button" accessibilityLabel={`Vitesse de lecture ${rate} fois. Changer`} hitSlop={8}>
      <Text variant="micro" weight="700" color={light ? colors.ink : dark.text}>
        {rate === 1 ? '1×' : rate === 1.5 ? '1,5×' : '2×'}
      </Text>
    </Pressable>
  );
}

/** « 🎙 Wolof · 0:42 » */
export function voiceSummary(language: string | null | undefined, durationMs: number | null | undefined): string {
  const lang = voiceLanguageLabel(language);
  return [lang, durationMs ? formatDuration(durationMs) : null].filter(Boolean).join(' · ');
}

/** A voice publication (no photo or video): a purposeful card, not an empty video frame. */
export function VoiceCard({
  uri,
  durationMs,
  waveform,
  language,
  active,
  tone = 'dark',
}: {
  uri: string | null;
  durationMs: number | null;
  waveform?: number[] | null;
  language?: string | null;
  active?: boolean;
  tone?: 'dark' | 'light';
}) {
  const v = useVoicePlayer(uri, durationMs, { active });
  const light = tone === 'light';
  const summary = voiceSummary(language, durationMs);
  return (
    <View style={[styles.card, light ? styles.cardLight : styles.cardDark]} accessibilityLabel={`Publication vocale${summary ? `, ${summary}` : ''}`}>
      <View style={styles.cardTop}>
        <Mic size={14} color={light ? colors.accentDeep : dark.mint} />
        <Text variant="micro" weight="700" color={light ? colors.accentDeep : dark.mint} style={{ letterSpacing: 0.6 }}>
          {language ? `EN ${voiceLanguageLabel(language)?.toUpperCase()}` : 'PUBLICATION VOCALE'}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <PlayButton playing={v.playing} loading={v.loading} onPress={v.toggle} size={56} label="Écouter la publication vocale" tone={light ? 'ink' : 'mint'} />
        <View style={{ flex: 1, gap: 6 }}>
          <Waveform values={waveform} progress={v.progress} height={36} color={light ? colors.borderStrong : dark.borderStrong} activeColor={light ? colors.ink : dark.mint} onSeek={v.seek} />
          <View style={styles.cardMeta}>
            <Text variant="caption" weight="600" color={light ? colors.textSecondary : dark.textSecondary}>
              {v.playing || v.positionMs > 0 ? `${formatDuration(v.positionMs)} / ${formatDuration(v.totalMs)}` : formatDuration(v.totalMs)}
            </Text>
            <RateButton rate={v.rate} onPress={v.cycleRate} light={light} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * A narration over photos: never plays by itself; keeps playing while the gallery changes.
 * `onPosition` lets the gallery follow the « visite guidée » cues.
 */
export function NarrationBar({
  uri,
  durationMs,
  waveform,
  language,
  active,
  onPosition,
}: {
  uri: string | null;
  durationMs: number | null;
  waveform?: number[] | null;
  language?: string | null;
  active?: boolean;
  onPosition?: (ms: number, playing: boolean) => void;
}) {
  const v = useVoicePlayer(uri, durationMs, { active });
  const report = useRef(onPosition);
  useEffect(() => {
    report.current = onPosition;
  });
  useEffect(() => {
    report.current?.(v.positionMs, v.playing);
  }, [v.positionMs, v.playing]);
  const summary = voiceSummary(language, durationMs);
  return (
    <View style={styles.narration}>
      <PlayButton playing={v.playing} loading={v.loading} onPress={v.toggle} size={36} label={`Écouter l’explication${summary ? `, ${summary}` : ''}`} tone="mint" />
      {v.playing || v.positionMs > 0 ? (
        <View style={{ width: 92 }}>
          <Waveform values={waveform} progress={v.progress} height={20} bars={24} color="rgba(247,246,243,0.35)" activeColor={colors.mint} onSeek={v.seek} />
        </View>
      ) : null}
      <Text variant="caption" weight="700" color={colors.white} numberOfLines={1} style={{ flexShrink: 1 }}>
        {v.playing || v.positionMs > 0 ? `${formatDuration(v.positionMs)} / ${formatDuration(v.totalMs)}` : `Écouter${summary ? ` · ${summary}` : ''}`}
      </Text>
      {v.playing ? <RateButton rate={v.rate} onPress={v.cycleRate} /> : null}
    </View>
  );
}

/** Compact preview (recorder review, composer attachment, chat preview). */
export function VoicePreview({ uri, durationMs, waveform, tone = 'light' }: { uri: string; durationMs: number; waveform?: number[] | null; tone?: 'light' | 'dark' }) {
  const v = useVoicePlayer(uri, durationMs);
  const light = tone === 'light';
  return (
    <View style={styles.preview}>
      <PlayButton playing={v.playing} loading={v.loading} onPress={v.toggle} size={40} label="Écouter l’enregistrement" tone={light ? 'ink' : 'mint'} />
      <View style={{ flex: 1 }}>
        <Waveform values={waveform} progress={v.progress} height={28} color={light ? colors.borderStrong : dark.borderStrong} activeColor={light ? colors.ink : dark.mint} onSeek={v.seek} />
      </View>
      <Text variant="caption" weight="700" color={light ? colors.textSecondary : dark.textSecondary} style={{ minWidth: 36, textAlign: 'right' }}>
        {formatDuration(v.playing || v.positionMs > 0 ? v.positionMs : durationMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  card: { marginHorizontal: 16, borderRadius: 22, padding: 16, gap: 12 },
  cardDark: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.mintLine },
  cardLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rate: { paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: dark.subtle, borderWidth: 1, borderColor: dark.borderStrong, alignItems: 'center', justifyContent: 'center' },
  rateLight: { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
  // Bottom-left over the photos, above the gallery dots.
  narration: { position: 'absolute', left: 12, bottom: 26, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '88%', paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
