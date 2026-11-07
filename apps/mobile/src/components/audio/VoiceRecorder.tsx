/**
 * One recording experience for publications, product presentations, statuses and chat (W1.2).
 *
 * - Record, pause, resume, finish; live level bars; « 0:42 / 3:00 »; a warning 15 s before the
 *   3-minute limit and an automatic stop at it; under 1 s is refused.
 * - The microphone permission is asked when the member presses record, with a clear way out when
 *   it is refused.
 * - An interruption (app in the background, browser tab hidden) pauses instead of losing the take.
 * - Web: AAC/MP4 when the browser can record it (plays everywhere), WebM/Opus otherwise (Chrome,
 *   Firefox), MP4 on Safari; the MIME type sent is the one the browser actually produced.
 */
import { formatDuration } from '@jefeli/shared';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type RecordingOptions } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Check, Mic, MicOff, Pause, RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Button, colors, dark, spacing, Text } from '@/design';
import { pauseAll } from '@/lib/playback';
import type { NarrationCue, RecordedClip } from '@/lib/voice';

import { VoicePreview } from './Voice';

export type { NarrationCue, RecordedClip };

export const MAX_VOICE_MS = 180_000;
const MIN_VOICE_MS = 1_000;

function webMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  // AAC/MP4 plays everywhere; otherwise WebM/Opus (Chrome, Firefox); Safari, which cannot record
  // WebM, falls through to its own MP4 (AAC). A generic « audio/mp4 » in Chromium is Opus-in-MP4,
  // no better than WebM, so it comes last.
  return ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
}

const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  web: { mimeType: Platform.OS === 'web' ? webMimeType() : undefined, bitsPerSecond: 64_000 },
};

/** dBFS (−160…0) → 0–100, tuned for speech near the phone. */
function level(db: number | undefined): number | null {
  if (typeof db !== 'number' || !Number.isFinite(db)) return null;
  return Math.round(Math.max(0, Math.min(1, (db + 55) / 50)) * 100);
}

function downsample(values: number[], n: number): number[] {
  if (values.length === 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const start = Math.floor((i * values.length) / n);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / n));
    let max = 0;
    for (let j = start; j < end && j < values.length; j++) max = Math.max(max, values[j] ?? 0);
    return max;
  });
}

export type RecordingPhase = 'idle' | 'requesting' | 'recording' | 'paused' | 'finishing' | 'denied' | 'error';

export function useVoiceRecording({ maxMs = MAX_VOICE_MS, onLimit }: { maxMs?: number; onLimit?: (clip: RecordedClip | null) => void } = {}) {
  const recorder = useAudioRecorder(OPTIONS);
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const samples = useRef<number[]>([]);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<RecordingPhase>('idle');
  const limitRef = useRef(onLimit);

  useEffect(() => {
    phaseRef.current = phase;
    limitRef.current = onLimit;
  });

  function stopTicking() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  function tick() {
    const status = recorder.getStatus();
    const ms = status.durationMillis ?? 0;
    last.current = Math.max(last.current, ms);
    setElapsedMs(last.current);
    const l = level(status.metering);
    if (l !== null) {
      samples.current.push(l);
      setLevels((prev) => [...prev.slice(-31), l]);
    }
    if (last.current >= maxMs && phaseRef.current === 'recording') {
      void finish().then((clip) => limitRef.current?.(clip));
    }
  }

  function startTicking() {
    stopTicking();
    timer.current = setInterval(tick, 100);
  }

  async function start(): Promise<boolean> {
    if (phaseRef.current === 'recording') return true;
    setPhase('requesting');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setPhase('denied');
        return false;
      }
      pauseAll();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      samples.current = [];
      last.current = 0;
      setLevels([]);
      setElapsedMs(0);
      recorder.record();
      setPhase('recording');
      startTicking();
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return true;
    } catch {
      setPhase(Platform.OS === 'web' ? 'denied' : 'error');
      return false;
    }
  }

  function pause() {
    if (phaseRef.current !== 'recording') return;
    recorder.pause();
    stopTicking();
    setPhase('paused');
  }

  function resume() {
    if (phaseRef.current !== 'paused') return;
    pauseAll();
    recorder.record();
    setPhase('recording');
    startTicking();
  }

  async function finish(): Promise<RecordedClip | null> {
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'paused') return null;
    phaseRef.current = 'finishing';
    setPhase('finishing');
    try {
      const status = recorder.getStatus();
      last.current = Math.max(last.current, status.durationMillis ?? 0);
    } catch {
      /* keep the last tick */
    }
    stopTicking();
    const durationMs = Math.min(last.current, maxMs);
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    setPhase('idle');
    if (!uri || durationMs < MIN_VOICE_MS) return null;
    let file: Blob | null = null;
    let mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
    if (Platform.OS === 'web') {
      try {
        file = await (await fetch(uri)).blob();
        mimeType = (file.type || mimeType).split(';')[0]!.trim() || mimeType;
      } catch {
        return null;
      }
    }
    return { uri, durationMs, mimeType, waveform: downsample(samples.current, 48), file };
  }

  async function cancel() {
    stopTicking();
    if (phaseRef.current === 'recording' || phaseRef.current === 'paused') {
      try {
        await recorder.stop();
      } catch {
        /* nothing to stop */
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
    setPhase('idle');
    setElapsedMs(0);
    setLevels([]);
  }

  // Interruptions pause the take instead of losing it.
  useEffect(() => {
    const interrupt = () => {
      if (phaseRef.current === 'recording') pause();
    };
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return undefined;
      const onVisibility = () => document.hidden && interrupt();
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && interrupt());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopTicking(), []);

  return { phase, elapsedMs, levels, maxMs, start, pause, resume, finish, cancel, reset: () => setPhase('idle') };
}

export type VoiceRecording = ReturnType<typeof useVoiceRecording>;

/** Live level bars while recording. */
export function LiveLevels({ levels, color, height = 40 }: { levels: number[]; color: string; height?: number }) {
  const bars = Array.from({ length: 32 }, (_, i) => levels[levels.length - 32 + i] ?? 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((v, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(3, (v / 100) * height), borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** Permission refused: what happened and how to fix it. */
export function MicDenied({ onRetry, tone = 'light' }: { onRetry: () => void; tone?: 'light' | 'dark' }) {
  const light = tone === 'light';
  return (
    <View style={{ gap: spacing.sm, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MicOff size={18} color={light ? colors.danger : dark.danger} />
        <Text variant="bodyStrong" tone={light ? 'default' : 'fog'}>
          Micro non autorisé
        </Text>
      </View>
      <Text variant="caption" tone={light ? 'secondary' : 'fogSecondary'}>
        {Platform.OS === 'web'
          ? 'Autorisez le micro pour ce site dans votre navigateur (icône à gauche de l’adresse), puis réessayez.'
          : 'Autorisez le micro pour Jëfëli dans les réglages du téléphone, puis réessayez.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {Platform.OS !== 'web' ? <Button label="Ouvrir les réglages" size="sm" variant="outline" onPress={() => void Linking.openSettings()} /> : null}
        <Button label="Réessayer" size="sm" variant="primary" onPress={onRetry} />
      </View>
    </View>
  );
}

/**
 * The recorder panel used in the publication composer and the status composer. With `photos`,
 * the member taps the photo they are talking about: those moments become the « visite guidée ».
 */
export function VoiceRecorderPanel({
  photos,
  onUse,
  onCancel,
  useLabel = 'Ajouter',
  tone = 'light',
}: {
  photos?: string[];
  onUse: (clip: RecordedClip) => void;
  onCancel: () => void;
  useLabel?: string;
  tone?: 'light' | 'dark';
}) {
  const light = tone === 'light';
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [cues, setCues] = useState<NarrationCue[]>([]);
  const [shown, setShown] = useState(0);
  const [tooShort, setTooShort] = useState(false);
  const rec = useVoiceRecording({ onLimit: (c) => c && review(c) });
  const hasPhotos = (photos?.length ?? 0) > 1;
  const live = rec.phase === 'recording' || rec.phase === 'paused';
  const remaining = rec.maxMs - rec.elapsedMs;

  function review(c: RecordedClip) {
    setClip({ ...c, cues: hasPhotos && cues.length > 0 ? cues.filter((x) => x.t <= c.durationMs) : undefined });
  }

  async function begin() {
    setTooShort(false);
    setClip(null);
    setShown(0);
    const ok = await rec.start();
    setCues(ok && hasPhotos ? [{ t: 0, i: 0 }] : []);
  }

  async function done() {
    const c = await rec.finish();
    if (!c) {
      setTooShort(true);
      return;
    }
    review(c);
  }

  function showPhoto(i: number) {
    setShown(i);
    if (!live) return;
    const t = rec.elapsedMs;
    setCues((prev) => {
      const kept = prev.filter((c) => c.t < t - 300);
      return kept[kept.length - 1]?.i === i ? kept : [...kept, { t, i }];
    });
  }

  const ink = light ? colors.ink : dark.text;
  const outline = light ? 'outline' : 'outlineDark';
  const ghost = light ? 'ghost' : 'ghostDark';
  const sub = light ? 'secondary' : 'fogSecondary';

  if (rec.phase === 'denied') return <MicDenied onRetry={begin} tone={tone} />;

  if (clip) {
    return (
      <View style={styles.panel}>
        <VoicePreview uri={clip.uri} durationMs={clip.durationMs} waveform={clip.waveform} tone={tone} />
        {clip.cues && clip.cues.length > 1 ? (
          <Text variant="caption" tone={sub}>
            Visite guidée : {new Set(clip.cues.map((c) => c.i)).size} photos montrées pendant l’explication.
          </Text>
        ) : null}
        <View style={styles.row}>
          <Button label="Refaire" size="sm" variant={outline} icon={RotateCcw} onPress={begin} />
          <Button label="Supprimer" size="sm" variant={ghost} icon={Trash2} onPress={() => (setClip(null), onCancel())} />
          <View style={{ flex: 1 }} />
          <Button label={useLabel} size="sm" variant="cta" icon={Check} onPress={() => onUse(clip)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {hasPhotos ? (
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone={sub}>
            {live ? 'Touchez la photo dont vous parlez.' : 'Pendant que vous parlez, touchez la photo dont vous parlez : les acheteurs la verront au bon moment.'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos!.map((uri, i) => (
              <Pressable key={`${uri}-${i}`} onPress={() => showPhoto(i)} style={[styles.photo, shown === i && styles.photoOn]} accessibilityRole="button" accessibilityLabel={`Montrer la photo ${i + 1}`} accessibilityState={{ selected: shown === i }}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {live || rec.phase === 'finishing' ? (
        <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
          <LiveLevels levels={rec.levels} color={rec.phase === 'paused' ? (light ? colors.borderStrong : dark.borderStrong) : light ? colors.accentDeep : dark.mint} />
          <View style={styles.row}>
            <View style={[styles.dot, rec.phase !== 'recording' && { opacity: 0.3 }]} />
            <Text variant="bodyStrong" color={ink}>
              {formatDuration(rec.elapsedMs)} / {formatDuration(rec.maxMs)}
            </Text>
            <Text variant="caption" tone={sub}>
              {rec.phase === 'paused' ? 'En pause' : remaining <= 15_000 ? `Encore ${Math.max(0, Math.ceil(remaining / 1000))} s` : 'Enregistrement…'}
            </Text>
          </View>
          <View style={styles.row}>
            <Button label="Annuler" size="sm" variant={ghost} icon={Trash2} onPress={() => void rec.cancel().then(onCancel)} />
            <View style={{ flex: 1 }} />
            {rec.phase === 'paused' ? (
              <Button label="Reprendre" size="sm" variant={outline} icon={Mic} onPress={rec.resume} />
            ) : (
              <Button label="Pause" size="sm" variant={outline} icon={Pause} onPress={rec.pause} disabled={rec.phase !== 'recording'} />
            )}
            <Button label="Terminer" size="sm" variant="cta" icon={Check} onPress={done} disabled={rec.phase === 'finishing'} />
          </View>
        </View>
      ) : (
        <View style={styles.idle}>
          <Pressable onPress={begin} disabled={rec.phase === 'requesting'} style={({ pressed }) => [styles.mic, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel="Commencer l’enregistrement">
            {rec.phase === 'requesting' ? <ActivityIndicator color={colors.night} /> : <Mic size={30} color={colors.night} />}
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" color={ink}>
              {rec.phase === 'requesting' ? 'Autorisation du micro…' : 'Appuyez pour parler'}
            </Text>
            <Text variant="caption" tone={sub}>
              {tooShort ? 'Trop court : parlez au moins une seconde.' : 'Jusqu’à 3 minutes. Pause possible à tout moment.'}
            </Text>
          </View>
          <Button label="Fermer" size="sm" variant={ghost} onPress={onCancel} />
        </View>
      )}
      {rec.phase === 'error' ? (
        <Text variant="caption" tone="danger">
          Impossible d’enregistrer sur cet appareil. Réessayez.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mic: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
  photo: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  photoOn: { borderColor: colors.mint },
});
