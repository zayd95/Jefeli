/**
 * Inline voice recording (P4): the microphone of the composer's toolbar records right where you are,
 * no second screen. A bar takes the toolbar's place: delete · ● timer · live levels · pause · done.
 * With two or more photos the member taps the photo they are talking about (the composer's own
 * thumbnails, through `cueRef`): those moments become the « visite guidée » (narration cues).
 *
 * Same recorder as everywhere (`useVoiceRecording`): 3-minute limit, under 1 s refused, interruptions
 * pause, a refused microphone explains how to allow it.
 */
import { formatDuration } from '@jefeli/shared';
import { Check, Mic, Pause, Play, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiveLevels, MicDenied, useVoiceRecording } from '@/components/audio/VoiceRecorder';
import { colors, dark, spacing, Text } from '@/design';
import type { NarrationCue, RecordedClip } from '@/lib/voice';

export function InlineVoice({
  hasPhotos,
  cueRef,
  onDone,
  onCancel,
}: {
  /** Two or more photos: tapping a thumbnail marks the photo being talked about. */
  hasPhotos: boolean;
  cueRef: MutableRefObject<((index: number) => void) | null>;
  onDone: (clip: RecordedClip) => void;
  onCancel: () => void;
}) {
  const [cues, setCues] = useState<NarrationCue[]>([]);
  const [tooShort, setTooShort] = useState(false);
  const cuesRef = useRef<NarrationCue[]>([]);
  const rec = useVoiceRecording({ onLimit: (clip) => clip && hand(clip) });
  const live = rec.phase === 'recording' || rec.phase === 'paused';
  const remaining = rec.maxMs - rec.elapsedMs;

  useEffect(() => {
    cuesRef.current = cues;
  });

  function hand(clip: RecordedClip) {
    const kept = hasPhotos ? cuesRef.current.filter((c) => c.t <= clip.durationMs) : [];
    onDone({ ...clip, cues: kept.length > 1 ? kept : undefined });
  }

  // Pressing the microphone starts recording at once.
  useEffect(() => {
    void rec.start().then((ok) => ok && hasPhotos && setCues([{ t: 0, i: 0 }]));
    return () => {
      cueRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The composer's thumbnails call this while recording.
  useEffect(() => {
    cueRef.current = (i: number) => {
      if (!live) return;
      const t = rec.elapsedMs;
      setCues((prev) => {
        const kept = prev.filter((c) => c.t < t - 300);
        return kept[kept.length - 1]?.i === i ? kept : [...kept, { t, i }];
      });
    };
  });

  async function finish() {
    const clip = await rec.finish();
    if (!clip) {
      setTooShort(true);
      return;
    }
    hand(clip);
  }
  async function discard() {
    await rec.cancel();
    onCancel();
  }

  if (rec.phase === 'denied' || rec.phase === 'error') {
    return (
      <View style={styles.denied}>
        <MicDenied onRetry={() => void rec.start()} tone="dark" />
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.closeLink}>
          <Text variant="callout" weight="700" color={colors.ink}>
            Fermer
          </Text>
        </Pressable>
      </View>
    );
  }

  const status =
    rec.phase === 'requesting'
      ? 'Autorisation du micro…'
      : rec.phase === 'paused'
        ? 'En pause'
        : tooShort
          ? 'Trop court : parlez au moins une seconde.'
          : live && remaining <= 15_000
            ? `Encore ${Math.max(0, Math.ceil(remaining / 1000))} s`
            : hasPhotos
              ? 'Touchez la photo dont vous parlez'
              : '3 min maximum';

  return (
    <View style={styles.wrap} testID="inline-voice" accessibilityLiveRegion="polite">
      <Text variant="caption" weight="600" tone="fogSecondary" style={{ textAlign: 'center' }}>
        {hasPhotos && !tooShort && live && remaining > 15_000 ? 'Touchez la photo dont vous parlez' : status}
      </Text>
      <View style={styles.bar}>
        <Pressable onPress={() => void discard()} style={styles.icon} accessibilityRole="button" accessibilityLabel="Supprimer l’enregistrement" testID="inline-voice-cancel">
          <Trash2 size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <View style={styles.timer}>
          <View style={[styles.dot, rec.phase === 'paused' && { backgroundColor: dark.textSecondary }]} />
          <Text variant="bodyStrong" color={colors.ink} style={{ fontVariant: ['tabular-nums'] }}>
            {formatDuration(rec.elapsedMs)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <LiveLevels levels={rec.levels} color={colors.gold} height={32} />
        </View>
        <Pressable onPress={() => (rec.phase === 'paused' ? rec.resume() : rec.pause())} style={styles.icon} accessibilityRole="button" accessibilityLabel={rec.phase === 'paused' ? 'Reprendre' : 'Mettre en pause'} disabled={!live}>
          {rec.phase === 'paused' ? <Play size={22} color={colors.ink} fill={colors.ink} /> : <Pause size={22} color={colors.ink} fill={colors.ink} />}
        </Pressable>
        <Pressable onPress={() => void finish()} style={[styles.icon, styles.done]} accessibilityRole="button" accessibilityLabel="Terminer l’enregistrement" disabled={!live} testID="inline-voice-done">
          <Check size={22} color={colors.ink} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, borderTopWidth: 1, borderTopColor: dark.border, backgroundColor: dark.background },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.gold },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  denied: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: dark.border },
  closeLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

void Mic;
