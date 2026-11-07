import { formatDuration } from '@jefeli/shared';
import { Check, Image as ImageIcon, Mic, Pause, Plus, Send, ShoppingBag, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, dark, fieldFontSize, fonts, Sheet, SheetAction, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import type { RecordedClip } from '@/lib/voice';

import { VoicePreview } from '../audio/Voice';
import { LiveLevels, MicDenied, useVoiceRecording } from '../audio/VoiceRecorder';

export type VoiceClip = RecordedClip;

/**
 * Chat composer. Voice notes use the shared recorder (W1.2): record, pause, resume, finish, then
 * listen before sending (or delete). 3 minutes at most. A conversation opened from an article keeps
 * an « À propos de » chip: text and voice sent with it carry that article.
 */
export function ChatComposer({
  onSendText,
  onPickImage,
  onSendVoice,
  onPickProducts,
  disabled,
  voiceEnabled = true,
  about,
  onClearAbout,
}: {
  onSendText: (text: string) => Promise<void>;
  onPickImage: () => void;
  /** When set, « + » offers a photo or articles (product cards) instead of opening the photo picker directly. */
  onPickProducts?: () => void;
  onSendVoice: (clip: VoiceClip) => Promise<void>;
  disabled?: boolean;
  voiceEnabled?: boolean;
  about?: { id: string; title: string } | null;
  onClearAbout?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attach, setAttach] = useState(false);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const rec = useVoiceRecording({ onLimit: (c) => c && setClip(c) });
  const recording = rec.phase === 'recording' || rec.phase === 'paused' || rec.phase === 'finishing';
  const pad = { paddingBottom: Math.max(insets.bottom, spacing.sm) };

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

  async function finish() {
    const c = await rec.finish();
    if (!c) toast('Message trop court : parlez au moins une seconde.', 'info');
    else setClip(c);
  }

  async function sendVoice() {
    if (!clip) return;
    setSending(true);
    try {
      await onSendVoice(clip);
      setClip(null);
    } finally {
      setSending(false);
    }
  }

  const aboutChip = about ? (
    <View style={styles.about}>
      <ShoppingBag size={14} color={dark.mint} />
      <Text variant="caption" weight="600" tone="fogSecondary" numberOfLines={1} style={{ flex: 1 }}>
        À propos de {about.title}
      </Text>
      {onClearAbout ? (
        <Pressable onPress={onClearAbout} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ne plus lier les messages à cet article">
          <X size={14} color={dark.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  if (rec.phase === 'denied') {
    return (
      <View style={[styles.wrap, pad]}>
        <MicDenied tone="dark" onRetry={() => void rec.start()} />
        <Pressable onPress={rec.reset} style={{ alignSelf: 'flex-start', paddingVertical: 8 }} accessibilityRole="button">
          <Text variant="callout" weight="600" tone="fogSecondary">
            Fermer
          </Text>
        </Pressable>
      </View>
    );
  }

  if (clip) {
    return (
      <View style={[styles.wrap, pad]}>
        {aboutChip}
        <View style={styles.row}>
          <Pressable onPress={() => setClip(null)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Supprimer le message vocal">
            <Trash2 size={22} color={dark.danger} />
          </Pressable>
          <View style={styles.previewBox}>
            <VoicePreview uri={clip.uri} durationMs={clip.durationMs} waveform={clip.waveform} tone="dark" />
          </View>
          <Pressable onPress={sendVoice} disabled={sending} style={[styles.send, sending && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Envoyer le message vocal">
            <Send size={19} color={colors.mint} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (recording) {
    return (
      <View style={[styles.wrap, pad]}>
        {aboutChip}
        <View style={styles.row}>
          <Pressable onPress={() => void rec.cancel()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Annuler l’enregistrement">
            <Trash2 size={22} color={dark.danger} />
          </Pressable>
          <View style={styles.recording} accessibilityLiveRegion="polite">
            <View style={[styles.recDot, rec.phase !== 'recording' && { opacity: 0.3 }]} />
            <Text variant="callout" weight="700" tone="fog" style={{ minWidth: 76 }}>
              {formatDuration(rec.elapsedMs)} / 3:00
            </Text>
            <View style={{ flex: 1 }}>
              <LiveLevels levels={rec.levels} color={rec.phase === 'paused' ? dark.borderStrong : dark.mint} height={22} />
            </View>
          </View>
          {rec.phase === 'paused' ? (
            <Pressable onPress={rec.resume} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Reprendre l’enregistrement">
              <Mic size={22} color={dark.text} />
            </Pressable>
          ) : (
            <Pressable onPress={rec.pause} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Mettre l’enregistrement en pause">
              <Pause size={22} color={dark.text} />
            </Pressable>
          )}
          <Pressable onPress={finish} disabled={rec.phase === 'finishing'} style={styles.send} accessibilityRole="button" accessibilityLabel="Terminer l’enregistrement">
            <Check size={20} color={colors.mint} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, pad]}>
      {aboutChip}
      <View style={styles.row}>
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
          <Sheet visible={attach} onClose={() => setAttach(false)} tone="dark">
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
          <Pressable onPress={() => void rec.start()} disabled={disabled || sending || rec.phase === 'requesting'} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Enregistrer un message vocal">
            <Mic size={22} color={dark.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Lovable glass composer on night: fog-tinted field, ink send button with a mint arrow.
  wrap: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: dark.border, backgroundColor: dark.header },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  iconBtn: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: dark.borderStrong, backgroundColor: dark.subtle, paddingHorizontal: spacing.md, justifyContent: 'center' },
  input: { fontFamily: fonts.regular, fontSize: fieldFontSize(15), color: dark.text, paddingVertical: 12, maxHeight: 110 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink, borderWidth: 1, borderColor: dark.mintLine, alignItems: 'center', justifyContent: 'center' },
  recording: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: dark.subtle },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
  previewBox: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 16, backgroundColor: dark.subtle },
  about: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 12, backgroundColor: dark.mintSoft, borderWidth: 1, borderColor: dark.mintLine },
});
