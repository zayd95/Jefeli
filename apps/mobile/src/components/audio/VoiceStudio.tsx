/**
 * Full-screen recording (W1.3). Opening it starts recording at once: no intermediate step.
 *
 * - Without photos: the member's portrait, a large timer, live levels (« 3a »).
 * - With photos: the photo fills the screen and the member taps the one they are talking about;
 *   those moments become the « visite guidée » (« 2c »).
 * - Supprimer · Pause/Reprendre · Terminer, in thumb reach. Terminer hands the clip back: the
 *   editor itself is the review (listen, redo, language), so nothing is published from here.
 * - 3-minute limit (warning 15 s before, automatic finish), under 1 s refused, interruptions pause,
 *   a refused microphone explains how to allow it.
 */
import { formatDuration, VOICE_LANGUAGES, voiceLanguageLabel } from '@jefeli/shared';
import { Image } from 'expo-image';
import { Check, ChevronDown, Mic, Pause, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, colors, dark, IconButton, radius, spacing, Text } from '@/design';
import type { NarrationCue, RecordedClip } from '@/lib/voice';

import { LiveLevels, MicDenied, useVoiceRecording } from './VoiceRecorder';

export function VoiceStudio(props: {
  visible: boolean;
  photos?: string[];
  language: string | null;
  onLanguage: (l: string | null) => void;
  onDone: (clip: RecordedClip) => void;
  onClose: () => void;
  title: string;
  avatar?: { path: string | null | undefined; name: string };
}) {
  // Mounted fresh on every opening: a new take, nothing left from the previous one.
  return (
    <Modal visible={props.visible} animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
      {props.visible ? <StudioBody {...props} /> : null}
    </Modal>
  );
}

function StudioBody({
  photos,
  language,
  onLanguage,
  onDone,
  onClose,
  title,
  avatar,
}: {
  visible: boolean;
  /** Photo URIs (two or more) for the « visite guidée ». */
  photos?: string[];
  language: string | null;
  onLanguage: (l: string | null) => void;
  onDone: (clip: RecordedClip) => void;
  onClose: () => void;
  /** What is being recorded (« Votre explication », « Présenter l’article »…). */
  title: string;
  avatar?: { path: string | null | undefined; name: string };
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const hasPhotos = (photos?.length ?? 0) > 1;
  const [shown, setShown] = useState(0);
  const [cues, setCues] = useState<NarrationCue[]>([]);
  const [tooShort, setTooShort] = useState(false);
  const [languages, setLanguages] = useState(false);
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

  async function begin() {
    setTooShort(false);
    setShown(0);
    const ok = await rec.start();
    setCues(ok && hasPhotos ? [{ t: 0, i: 0 }] : []);
  }

  // Opening the studio is the press on « Voix »: start right away.
  useEffect(() => {
    void rec.start().then((ok) => ok && hasPhotos && setCues([{ t: 0, i: 0 }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    onClose();
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

  const langLabel = voiceLanguageLabel(language);
  const status =
    rec.phase === 'requesting'
      ? 'Autorisation du micro…'
      : rec.phase === 'paused'
        ? 'En pause'
        : rec.phase === 'finishing'
          ? 'Un instant…'
          : tooShort
            ? 'Trop court : parlez au moins une seconde.'
            : live && remaining <= 15_000
              ? `Encore ${Math.max(0, Math.ceil(remaining / 1000))} s`
              : 'Enregistrement · 3 min maximum';

  return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
        <View style={styles.top}>
          <IconButton icon={X} label="Annuler l’enregistrement" variant="glass" color={dark.text} onPress={() => void discard()} />
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="700" tone="fog" numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Pressable
            onPress={() => setLanguages((v) => !v)}
            style={styles.langPill}
            accessibilityRole="button"
            accessibilityLabel={`Langue parlée : ${langLabel ?? 'non précisée'}. Changer`}
            accessibilityState={{ expanded: languages }}
            aria-expanded={languages}
          >
            <Text variant="caption" weight="700" tone="mint">
              {langLabel ? `En ${langLabel.toLowerCase()}` : 'Langue'}
            </Text>
            <ChevronDown size={14} color={dark.mint} />
          </Pressable>
        </View>
        {languages ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langs} accessibilityRole="radiogroup">
            {VOICE_LANGUAGES.map((l) => {
              const on = language === l.key;
              return (
                <Pressable
                  key={l.key}
                  onPress={() => {
                    onLanguage(on ? null : l.key);
                    setLanguages(false);
                  }}
                  style={[styles.lang, on && styles.langOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  accessibilityLabel={l.label}
                >
                  <Text variant="caption" weight="700" color={on ? colors.night : dark.text}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.stage}>
          {rec.phase === 'denied' ? (
            <View style={styles.denied}>
              <MicDenied onRetry={() => void begin()} tone="dark" />
            </View>
          ) : hasPhotos ? (
            <>
              <View style={[styles.photo, { maxHeight: height * 0.52 }]}>
                <Image source={{ uri: photos![shown] }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photo ${shown + 1} sur ${photos!.length}`} />
                <View style={styles.photoTimer}>
                  <View style={[styles.dot, rec.phase !== 'recording' && { opacity: 0.3 }]} />
                  <Text variant="callout" weight="800" color={colors.white}>
                    {formatDuration(rec.elapsedMs)}
                  </Text>
                  <Text variant="caption" weight="600" color={dark.textSecondary}>
                    / {formatDuration(rec.maxMs)}
                  </Text>
                </View>
              </View>
              <Text variant="callout" weight="700" tone="fog" align="center">
                Touchez la photo dont vous parlez
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {photos!.map((uri, i) => (
                  <Pressable
                    key={`${uri}-${i}`}
                    onPress={() => showPhoto(i)}
                    style={[styles.thumb, shown === i && styles.thumbOn]}
                    accessibilityRole="button"
                    accessibilityLabel={`Montrer la photo ${i + 1}`}
                    accessibilityState={{ selected: shown === i }}
                  >
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
              <Text variant="caption" tone="fogSecondary" align="center" accessibilityLiveRegion="polite">
                {status}
              </Text>
            </>
          ) : (
            <View style={styles.voiceStage}>
              <View style={[styles.ring, rec.phase === 'recording' && styles.ringOn]}>
                <Avatar path={avatar?.path} name={avatar?.name ?? 'Moi'} size={108} />
              </View>
              <Text serif weight="600" tone="fog" style={{ fontSize: 48, lineHeight: 56 }} accessibilityLabel={`Durée ${formatDuration(rec.elapsedMs)}`}>
                {formatDuration(rec.elapsedMs)}
              </Text>
              <Text variant="callout" tone="fogSecondary" accessibilityLiveRegion="polite">
                {status}
              </Text>
              <View style={{ width: '80%', maxWidth: 320 }}>
                <LiveLevels levels={rec.levels} color={rec.phase === 'paused' ? dark.borderStrong : dark.mint} height={44} />
              </View>
            </View>
          )}
        </View>

        {rec.phase !== 'denied' ? (
          <View style={styles.controls}>
            <Control icon={Trash2} label="Supprimer" a11y="Supprimer l’enregistrement" onPress={() => void discard()} />
            {rec.phase === 'paused' ? (
              <Control icon={Mic} label="Reprendre" a11y="Reprendre l’enregistrement" onPress={rec.resume} big />
            ) : live ? (
              <Control icon={Pause} label="Pause" a11y="Mettre en pause" onPress={rec.pause} big />
            ) : (
              <Control icon={Mic} label={rec.phase === 'requesting' ? '…' : 'Enregistrer'} a11y="Commencer l’enregistrement" onPress={() => void begin()} big busy={rec.phase === 'requesting'} />
            )}
            <Control icon={Check} label="Terminer" a11y="Terminer l’enregistrement" onPress={() => void finish()} primary disabled={!live} />
          </View>
        ) : null}
        {rec.phase === 'error' ? (
          <Text variant="caption" tone="danger" align="center">
            Impossible d’enregistrer sur cet appareil. Réessayez.
          </Text>
        ) : null}
      </View>
  );
}

function Control({ icon: Icon, label, a11y, onPress, big, primary, disabled, busy }: { icon: typeof Mic; label: string; a11y: string; onPress: () => void; big?: boolean; primary?: boolean; disabled?: boolean; busy?: boolean }) {
  const size = big ? 72 : 56;
  return (
    <View style={{ alignItems: 'center', gap: 6, width: 88 }}>
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        style={({ pressed }) => [
          { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
          primary ? { backgroundColor: colors.mint } : big ? { backgroundColor: dark.text } : { borderWidth: 1, borderColor: dark.borderStrong },
          disabled && { opacity: 0.4 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      >
        {busy ? <ActivityIndicator color={colors.night} /> : <Icon size={big ? 30 : 24} color={primary || big ? colors.night : dark.text} />}
      </Pressable>
      <Text variant="caption" weight="700" tone="fog">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.background, paddingHorizontal: spacing.lg, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langPill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: dark.mintLine, backgroundColor: dark.mintSoft },
  langs: { gap: 6, paddingVertical: 2 },
  lang: { paddingHorizontal: 12, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: dark.subtle, borderWidth: 1, borderColor: dark.borderStrong },
  langOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  stage: { flex: 1, justifyContent: 'center', gap: spacing.md },
  denied: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: dark.surface },
  photo: { width: '100%', aspectRatio: 0.86, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: dark.surface },
  photoTimer: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: dark.glass },
  thumbs: { gap: 10, paddingHorizontal: 2, justifyContent: 'center', flexGrow: 1 },
  thumb: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.mint },
  voiceStage: { alignItems: 'center', gap: spacing.md },
  ring: { padding: 6, borderRadius: 70, borderWidth: 2, borderColor: dark.borderStrong },
  ringOn: { borderColor: colors.mint },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
});
