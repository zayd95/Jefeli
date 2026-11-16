/**
 * Studio capture (P2): the full-screen camera opens directly.
 *
 * Bottom mode bar: Photo · Vidéo · Voix · Texte. Gallery thumbnail bottom left, flash and camera
 * flip top right, a numbered strip of up to 8 photos for multi-shot items. Photo and Vidéo use the
 * camera; Voix opens the existing recorder (alone, or narrating the photos / video already
 * taken); Texte is a coloured card with starters. Nothing is uploaded here: the composer, then
 * the one media pipeline, do that.
 *
 * Without a camera (permission refused, desktop without one) the screen says so and the gallery
 * stays available: nothing is a dead end.
 */
import { formatDuration, MAX_PHOTOS, TEXT_STARTERS, type StudioMode, type TextStarter } from '@jefeli/shared';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { Camera as CameraIcon, ImagePlus, Mic, RefreshCw, X, Zap, ZapOff } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, colors, dark, fonts, IconButton, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { localFromUri } from '@/lib/studio';
import { startWebRecording, type WebRecording } from '@/lib/webRecorder';
import { MAX_VIDEO_SECONDS, pickMedia, uploadErrorMessage, type LocalMedia } from '@/lib/upload';

const MODES: { key: StudioMode; label: string }[] = [
  { key: 'photo', label: 'Photo' },
  { key: 'video', label: 'Vidéo' },
  { key: 'voice', label: 'Voix' },
  { key: 'text', label: 'Texte' },
];

export interface CaptureProps {
  mode: StudioMode;
  onMode: (m: StudioMode) => void;
  photos: LocalMedia[];
  video: LocalMedia | null;
  voiceLabel: string | null;
  text: string;
  starter: TextStarter | null;
  onText: (text: string, starter: TextStarter | null) => void;
  onPhotos: (next: LocalMedia[]) => void;
  onVideo: (m: LocalMedia | null) => void;
  onOpenVoice: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function StudioCapture(p: CaptureProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const camera = useRef<CameraView | null>(null);
  const [perm, askCamera] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);
  const stageRef = useRef<ComponentRef<typeof View> | null>(null);
  const webRec = useRef<WebRecording | null>(null);
  const hasCamera = p.mode === 'photo' || p.mode === 'video';
  const granted = !!perm?.granted;
  const total = p.photos.length + (p.video ? 1 : 0);
  const anything = total > 0 || !!p.voiceLabel || p.text.trim().length > 0;
  const last = p.video ?? p.photos[p.photos.length - 1] ?? null;

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (Platform.OS === 'web' && ms >= MAX_VIDEO_SECONDS * 1000) void finishWeb();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  async function shoot() {
    if (!camera.current || busy) return;
    if (p.photos.length >= MAX_PHOTOS) {
      toast(`${MAX_PHOTOS} photos au maximum.`, 'info');
      return;
    }
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.85 });
      const media = await localFromUri(pic.uri, 'image', { width: pic.width, height: pic.height }, null, 'image/jpeg');
      p.onPhotos([...p.photos, media]);
    } catch {
      toast('La photo n’a pas pu être prise. Réessayez ou choisissez-la dans la galerie.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finishWeb() {
    const rec = webRec.current;
    webRec.current = null;
    if (!rec) return;
    try {
      const out = await rec.stop();
      const durationMs = Math.min(Date.now() - startedAt.current, MAX_VIDEO_SECONDS * 1000);
      const uri = URL.createObjectURL(out.file);
      p.onVideo({
        uri,
        kind: 'video',
        width: out.width,
        height: out.height,
        durationMs,
        mimeType: (out.file.type || 'video/webm').split(';')[0] ?? 'video/webm',
        fileSize: out.file.size,
        file: out.file,
        posterFile: out.poster,
        posterUri: out.poster ? URL.createObjectURL(out.poster) : null,
      });
    } catch {
      toast('L’enregistrement a échoué. Réessayez ou choisissez la vidéo dans la galerie.', 'error');
    } finally {
      setRecording(false);
    }
  }

  async function toggleRecording() {
    if (Platform.OS === 'web') {
      if (recording) {
        await finishWeb();
        return;
      }
      try {
        startedAt.current = Date.now();
        setElapsed(0);
        webRec.current = await startWebRecording(stageRef.current as unknown as HTMLElement, MAX_VIDEO_SECONDS * 1000);
        setRecording(true);
      } catch {
        webRec.current = null;
        toast('La caméra du navigateur ne permet pas de filmer ici. Choisissez la vidéo dans la galerie.', 'info');
      }
      return;
    }
    if (!camera.current) return;
    if (recording) {
      camera.current.stopRecording();
      return;
    }
    if (!micPerm?.granted) {
      const res = await askMic();
      if (!res.granted) {
        toast('Autorisez le micro pour filmer avec le son, ou choisissez une vidéo dans la galerie.', 'info');
        return;
      }
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
    try {
      const rec = await camera.current.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (rec?.uri) {
        const durationMs = Math.min(Date.now() - startedAt.current, MAX_VIDEO_SECONDS * 1000);
        p.onVideo(await localFromUri(rec.uri, 'video', { width: 720, height: 1280 }, durationMs, 'video/mp4'));
      }
    } catch {
      toast('L’enregistrement a échoué. Réessayez ou choisissez la vidéo dans la galerie.', 'error');
    } finally {
      setRecording(false);
    }
  }

  async function gallery() {
    try {
      const picked = await pickMedia({ allowVideo: true, multiple: true, limit: MAX_PHOTOS });
      if (!picked?.length) return;
      const video = picked.find((m) => m.kind === 'video');
      if (video) {
        p.onVideo(video);
        p.onMode('video');
      } else {
        p.onPhotos([...p.photos, ...picked].slice(0, MAX_PHOTOS));
        p.onMode('photo');
      }
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }

  const strip =
    p.mode === 'photo' && p.photos.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityLabel={`${p.photos.length} photos prises`} testID="studio-strip">
        {p.photos.map((m, i) => (
          <View key={`${m.uri}-${i}`} style={styles.stripItem}>
            <Image source={{ uri: m.uri }} style={styles.stripImg} contentFit="cover" />
            <View style={styles.stripNum}>
              <Text variant="micro" weight="800" color={colors.night}>
                {i + 1}
              </Text>
            </View>
            <Pressable
              onPress={() => p.onPhotos(p.photos.filter((_, j) => j !== i))}
              style={styles.stripRemove}
              accessibilityRole="button"
              accessibilityLabel={`Retirer la photo ${i + 1}`}
              hitSlop={8}
            >
              <X size={12} color={colors.white} strokeWidth={3} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    ) : null;

  return (
    <View style={styles.root} testID="studio-capture">
      {/* Stage */}
      <View style={styles.stage} ref={stageRef}>
        {hasCamera && granted && !failed ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode={p.mode === 'video' ? 'video' : 'picture'}
            mute={false}
            onCameraReady={() => setReady(true)}
            onMountError={() => setFailed(true)}
          />
        ) : hasCamera ? (
          <View style={[StyleSheet.absoluteFill, styles.noCamera]}>
            <CameraIcon size={40} color={dark.textSecondary} />
            <Text variant="bodyStrong" tone="fog" align="center">
              {failed ? 'La caméra n’est pas disponible ici.' : 'Jëfëli a besoin de la caméra pour photographier ou filmer.'}
            </Text>
            <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
              {!failed && !granted ? <Button label="Autoriser la caméra" variant="outlineDark" pill onPress={() => void askCamera()} /> : null}
              <Button label="Choisir dans la galerie" variant="outlineDark" pill icon={ImagePlus} onPress={gallery} />
            </View>
          </View>
        ) : p.mode === 'voice' ? (
          <View style={[StyleSheet.absoluteFill, styles.panel]}>
            <Pressable onPress={p.onOpenVoice} style={styles.micBig} accessibilityRole="button" accessibilityLabel="Enregistrer ma voix">
              <Mic size={34} color={colors.night} />
            </Pressable>
            <Text variant="headline" weight="800" tone="fog" align="center">
              {p.voiceLabel ?? 'Parlez, c’est tout.'}
            </Text>
            <Text variant="callout" tone="fogSecondary" align="center" style={{ maxWidth: 300 }}>
              {total > 0 ? 'Votre voix racontera vos photos ou votre vidéo.' : 'Une voix seule, jusqu’à 3 minutes. Vous pouvez aussi la poser sur des photos.'}
            </Text>
          </View>
        ) : (
          <TextCard text={p.text} starter={p.starter} onText={p.onText} />
        )}

        {/* Top controls */}
        <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.sm) }]} pointerEvents="box-none">
          <IconButton icon={X} label="Fermer le Studio" variant="glass" color={colors.white} onPress={p.onClose} />
          <View style={{ flex: 1 }} />
          {hasCamera && granted && !failed ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {Platform.OS !== 'web' ? (
                <IconButton
                  icon={flash === 'off' ? ZapOff : Zap}
                  label={flash === 'off' ? 'Activer le flash' : 'Couper le flash'}
                  variant="glass"
                  color={colors.white}
                  onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
                />
              ) : null}
              <IconButton icon={RefreshCw} label="Retourner la caméra" variant="glass" color={colors.white} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
            </View>
          ) : null}
        </View>

        {recording ? (
          <View style={styles.recBadge} accessibilityLiveRegion="polite">
            <View style={styles.recDot} />
            <Text variant="callout" weight="800" color={colors.white}>
              {formatDuration(elapsed)} / 3:00
            </Text>
          </View>
        ) : null}
        {p.mode === 'photo' && p.photos.length > 0 ? (
          <View style={styles.count}>
            <Text variant="caption" weight="800" color={colors.white}>
              {`${p.photos.length}/${MAX_PHOTOS}`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {strip}
        <View style={styles.shutterRow}>
          <Pressable onPress={gallery} style={styles.gallery} accessibilityRole="button" accessibilityLabel="Ouvrir la galerie" testID="studio-gallery">
            {last ? <Image source={{ uri: last.posterUri ?? last.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImagePlus size={22} color={colors.white} />}
          </Pressable>

          {hasCamera ? (
            <Pressable
              onPress={p.mode === 'photo' ? shoot : toggleRecording}
              disabled={!granted || failed || (!ready && Platform.OS !== 'web')}
              style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }, (!granted || failed) && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel={p.mode === 'photo' ? 'Prendre la photo' : recording ? 'Arrêter l’enregistrement' : 'Démarrer l’enregistrement'}
              testID="studio-shutter"
            >
              <View style={[styles.shutterInner, p.mode === 'video' && styles.shutterVideo, recording && styles.shutterRec]} />
            </Pressable>
          ) : (
            <View style={{ width: 76 }} />
          )}

          <View style={styles.nextSlot}>
            {anything ? <Button label="Suivant" variant="cta" pill onPress={p.onNext} testID="studio-next" /> : null}
          </View>
        </View>

        <View style={styles.modeBar} accessibilityRole="tablist" aria-label="Mode de création">
          {MODES.map((m) => {
            const on = p.mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => !recording && p.onMode(m.key)}
                style={[styles.modePill, on && styles.modePillOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                aria-selected={on}
                accessibilityLabel={m.label}
              >
                <Text variant="callout" weight={on ? '800' : '600'} color={on ? colors.ink : dark.textSecondary}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** The « Texte » mode: a coloured card, the starters on top. A text post is never a priced item. */
function TextCard({ text, starter, onText }: { text: string; starter: TextStarter | null; onText: (t: string, s: TextStarter | null) => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.textStage]}>
      <View style={styles.textCard}>
        <TextInput
          value={text}
          onChangeText={(t) => onText(t, starter)}
          placeholder="Écrivez ce que vous cherchez, ce que vous voulez demander…"
          placeholderTextColor={dark.textSecondary}
          multiline
          maxLength={500}
          autoFocus={Platform.OS === 'web'}
          style={[styles.textInput, WEB_NO_OUTLINE]}
          accessibilityLabel="Votre texte"
          testID="studio-text"
        />
      </View>
      <View style={styles.starters}>
        {TEXT_STARTERS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => onText(text.trim() ? text : s.text, s.key)}
            style={[styles.starter, starter === s.key && styles.starterOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: starter === s.key }}
            accessibilityLabel={s.label}
          >
            <Text variant="callout" weight="700" color={colors.ink}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mediaBackdrop },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: colors.mediaBackdrop },
  noCamera: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  panel: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl, backgroundColor: dark.background },
  micBig: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center' },
  recBadge: { position: 'absolute', top: 76, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: dark.glass },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
  count: { position: 'absolute', top: 84, right: spacing.md, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  bottom: { backgroundColor: colors.mediaBackdrop, paddingTop: spacing.sm, gap: spacing.md },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  stripItem: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', backgroundColor: dark.surface },
  stripImg: { width: 54, height: 54 },
  stripNum: { position: 'absolute', left: 4, bottom: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stripRemove: { position: 'absolute', right: 2, top: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  gallery: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.glassBorder, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  shutterVideo: { backgroundColor: colors.live },
  shutterRec: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.live },
  nextSlot: { minWidth: 96, alignItems: 'flex-end' },
  modeBar: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  modePill: { minWidth: 72, height: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  modePillOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  textStage: { backgroundColor: dark.background, padding: spacing.lg, paddingTop: 84, gap: spacing.lg },
  textCard: { flex: 1, borderRadius: 20, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.goldLine, padding: spacing.lg, justifyContent: 'center' },
  textInput: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, color: colors.ink, textAlign: 'left', textAlignVertical: 'center' },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starter: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border },
  starterOn: { backgroundColor: colors.raised, borderColor: colors.gold },
});
