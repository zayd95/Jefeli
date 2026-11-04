import { formatDuration } from '@jefeli/shared';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Image as ImageIcon, Mic, Plus, Send, ShoppingBag, Square, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, Sheet, SheetAction, spacing, Text, useToast, dark, WEB_NO_OUTLINE } from '@/design';

export interface VoiceClip {
  uri: string;
  durationMs: number;
  mimeType: string;
}

export function ChatComposer({
  onSendText,
  onPickImage,
  onSendVoice,
  onPickProducts,
  disabled,
  voiceEnabled = true,
}: {
  onSendText: (text: string) => Promise<void>;
  onPickImage: () => void;
  /** When set, « + » offers a photo or articles (product cards) instead of opening the photo picker directly. */
  onPickProducts?: () => void;
  onSendVoice: (clip: VoiceClip) => Promise<void>;
  disabled?: boolean;
  voiceEnabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [attach, setAttach] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const started = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSendText(t);
      setText('');
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast('Accès au micro refusé. Autorisez-le dans les réglages du téléphone.', 'error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      started.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const ms = Date.now() - started.current;
        setElapsed(ms);
        if (ms >= 120_000) stopRecording(true);
      }, 250);
    } catch {
      toast('Impossible de démarrer l’enregistrement sur cet appareil.', 'error');
    }
  }

  async function stopRecording(sendIt: boolean) {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const duration = Date.now() - started.current;
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    if (!sendIt || !uri) return;
    if (duration < 800) {
      toast('Message trop court. Maintenez l’enregistrement un peu plus longtemps.', 'info');
      return;
    }
    setSending(true);
    try {
      await onSendVoice({ uri, durationMs: duration, mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4' });
    } finally {
      setSending(false);
    }
  }

  if (recording) {
    return (
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable onPress={() => stopRecording(false)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Annuler l’enregistrement">
          <Trash2 size={22} color={dark.danger} />
        </Pressable>
        <View style={styles.recording} accessibilityLiveRegion="polite">
          <View style={styles.recDot} />
          <Text variant="callout" weight="600" tone="fog">
            Enregistrement… {formatDuration(elapsed)}
          </Text>
        </View>
        <Pressable onPress={() => stopRecording(true)} style={styles.send} accessibilityRole="button" accessibilityLabel="Envoyer le message vocal">
          <Square size={16} color={colors.action} fill={colors.action} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <Pressable
        onPress={onPickProducts ? () => setAttach(true) : onPickImage}
        disabled={disabled}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel={onPickProducts ? 'Joindre une photo ou des articles' : 'Envoyer une photo'}
      >
        <Plus size={24} color={dark.text} />
      </Pressable>
      {onPickProducts ? (
        <Sheet visible={attach} onClose={() => setAttach(false)}>
          <SheetAction
            icon={ImageIcon}
            label="Envoyer une photo"
            onPress={() => {
              setAttach(false);
              onPickImage();
            }}
          />
          <SheetAction
            icon={ShoppingBag}
            label="Envoyer des articles"
            description="Une fiche par article, de sa boutique ou de la vôtre."
            onPress={() => {
              setAttach(false);
              onPickProducts();
            }}
          />
        </Sheet>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message…"
          placeholderTextColor={dark.textTertiary}
          selectionColor={dark.mint}
          multiline
          maxLength={4000}
          editable={!disabled}
          style={[styles.input, WEB_NO_OUTLINE]}
          accessibilityLabel="Message"
          onSubmitEditing={Platform.OS === 'web' ? send : undefined}
          blurOnSubmit={false}
        />
      </View>
      {text.trim() ? (
        <Pressable onPress={send} disabled={sending || disabled} style={[styles.send, (sending || disabled) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Envoyer">
          <Send size={19} color={colors.mint} />
        </Pressable>
      ) : voiceEnabled ? (
        <Pressable onPress={startRecording} disabled={disabled || sending} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Enregistrer un message vocal">
          <Mic size={22} color={dark.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Lovable glass composer on night: fog-tinted field, ink send button with a mint arrow.
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: dark.border, backgroundColor: dark.header },
  iconBtn: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: dark.borderStrong, backgroundColor: dark.subtle, paddingHorizontal: spacing.md, justifyContent: 'center' },
  input: { fontFamily: fonts.regular, fontSize: 15, color: dark.text, paddingVertical: 12, maxHeight: 110 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, borderWidth: 1, borderColor: dark.mintLine, alignItems: 'center', justifyContent: 'center' },
  recording: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: dark.subtle },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
});
