import { AUDIENCE_LABELS, formatXOF, toFrenchError, type Audience, hasDisplayedPrice } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, ImagePlus, Mic, ShoppingBag, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { VoicePreview } from '@/components/audio/Voice';
import { VoiceRecorderPanel } from '@/components/audio/VoiceRecorder';
import { ChoicePills, OptionRow, UploadOverlay } from '@/components/Composer';
import { VideoPlayerInline } from '@/components/Media';
import { PublishHeader } from '@/components/PublishSwitcher';
import { Button, Chip, colors, dark, fonts, IconButton, Screen, Sheet, spacing, Text, useToast } from '@/design';
import { fetchSellerProducts } from '@/lib/api/products';
import { getSettings } from '@/lib/api/profiles';
import { createStory } from '@/lib/api/stories';
import { useAuth } from '@/lib/auth';
import { pickMedia, uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';
import { goBack } from '@/lib/nav';
import { uploadVoice, type RecordedClip } from '@/lib/voice';

export default function NewStatus() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [voice, setVoice] = useState<RecordedClip | null>(null);
  const [recording, setRecording] = useState(false);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const settings = useQuery({ queryKey: ['settings', userId], queryFn: () => getSettings(userId ?? ''), enabled: !!userId });
  const products = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });
  const effectiveAudience = (audience ?? (settings.data?.default_status_audience as Audience | undefined) ?? 'followers') as Audience;

  async function choose(camera: boolean) {
    try {
      const picked = await pickMedia({ allowVideo: true, camera });
      if (picked?.[0]) setMedia(picked[0]);
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }

  async function publish() {
    if (!userId || (!media && !voice)) return;
    abort.current = new AbortController();
    setUploading(true);
    try {
      if (voice) {
        // W1.2: a voice status (private bucket, audience rules and 24-hour expiry like any status).
        const up = await uploadVoice(userId, voice, { bucket: 'private-media', folder: 'stories', onProgress: setProgress, signal: abort.current.signal });
        await createStory({ media_kind: 'audio', path: up.path, width: null, height: null, duration_ms: up.duration_ms, caption: caption.trim(), audience: effectiveAudience, product_id: productId });
        qc.invalidateQueries({ queryKey: ['story-rail'] });
        qc.invalidateQueries({ queryKey: ['active-stories', userId] });
        toast('Statut publié pour 24 h', 'success');
        goBack();
        return;
      }
      if (!media) return;
      const [up] = await uploadMediaBatch(userId, [{ ...media, file: media.file ?? null }], {
        bucket: 'private-media',
        folder: 'stories',
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      if (!up) throw new Error('upload');
      await createStory({
        media_kind: up.kind,
        path: up.path,
        poster_path: up.poster_path,
        width: up.width,
        height: up.height,
        duration_ms: up.duration_ms,
        caption: caption.trim(),
        audience: effectiveAudience,
        product_id: productId,
      });
      qc.invalidateQueries({ queryKey: ['story-rail'] });
      qc.invalidateQueries({ queryKey: ['active-stories', userId] });
      toast('Statut publié pour 24 h', 'success');
      goBack();
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  if (!media && !voice) {
    // Lovable « Statut » mode, next to Publication and Article in the same switcher.
    return (
      <Screen edges={['top', 'bottom']}>
        <PublishHeader mode="status" />
        <ScrollView contentContainerStyle={styles.pickArea}>
          <View style={{ gap: 4 }}>
            <Text serif weight="600" style={{ fontSize: 26, lineHeight: 31, color: colors.ink }}>
              Votre statut, 24 heures.
            </Text>
            <Text variant="caption" tone="secondary" style={{ fontSize: 13 }}>
              Photo, vidéo ou voix, 3 min max.
            </Text>
          </View>
          <View style={{ gap: spacing.md }}>
            {Platform.OS !== 'web' ? <Button label="Prendre une photo ou une vidéo" icon={Camera} variant="primary" size="lg" pill onPress={() => choose(true)} /> : null}
            <Button label="Choisir dans la galerie" icon={ImagePlus} variant="outline" size="lg" pill onPress={() => choose(false)} style={{ backgroundColor: colors.surface }} />
            <Button label="Enregistrer ma voix" icon={Mic} variant="outline" size="lg" pill onPress={() => setRecording(true)} style={{ backgroundColor: colors.surface }} />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
              Qui peut voir votre statut ?
            </Text>
            <ChoicePills<Audience> value={effectiveAudience} onChange={setAudience} options={(['public', 'followers', 'friends'] as Audience[]).map((k) => ({ key: k, label: AUDIENCE_LABELS[k] }))} />
            <Text variant="caption" tone="secondary">
              Les réponses arrivent en message privé.
            </Text>
          </View>
        </ScrollView>
        <Sheet visible={recording} onClose={() => setRecording(false)} title="Votre statut vocal">
          <VoiceRecorderPanel onUse={(c) => (setVoice(c), setRecording(false))} onCancel={() => setRecording(false)} useLabel="Continuer" />
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} background={colors.ink} keyboard>
      <View style={styles.previewWrap}>
        <View style={styles.preview}>
          {voice ? (
            <View style={[StyleSheet.absoluteFill, styles.voiceStage]}>
              <View style={styles.voiceBadge}>
                <Mic size={16} color={colors.night} />
                <Text variant="callout" weight="700" color={colors.night}>
                  Statut vocal
                </Text>
              </View>
              <View style={{ width: '82%' }}>
                <VoicePreview uri={voice.uri} durationMs={voice.durationMs} waveform={voice.waveform} tone="dark" />
              </View>
            </View>
          ) : media?.kind === 'image' ? (
            <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : media ? (
            <VideoPlayerInline uri={media.uri} active />
          ) : null}
          <View style={styles.previewTop}>
            <IconButton icon={X} label="Changer de média" color={colors.white} variant="overlay" onPress={() => (setMedia(null), setVoice(null))} />
          </View>
          <View style={styles.captionWrap}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Ajouter une légende…"
              placeholderTextColor="rgba(255,255,255,0.7)"
              maxLength={200}
              style={styles.caption}
              accessibilityLabel="Légende du statut"
            />
          </View>
        </View>
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={{ gap: spacing.md, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="callout" weight="600" color={colors.white}>
          Visible par
        </Text>
        <OptionRow<Audience>
          tone="dark"
          value={effectiveAudience}
          onChange={setAudience}
          options={(['public', 'followers', 'friends'] as Audience[]).map((k) => ({ key: k, label: AUDIENCE_LABELS[k] }))}
        />
        {(products.data ?? []).length > 0 ? (
          <>
            <Text variant="callout" weight="600" color={colors.white}>
              Lier un article (facultatif)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(products.data ?? []).map((p) => (
                <Chip
                  key={p.id}
                  icon={ShoppingBag}
                  label={`${p.title.slice(0, 22)}${hasDisplayedPrice(p) ? ` · ${formatXOF(p.price_xof, { compact: true })}` : ''}`}
                  selected={productId === p.id}
                  tone="dark"
                  onPress={() => setProductId(productId === p.id ? null : p.id)}
                  style={productId === p.id ? { backgroundColor: colors.action } : { backgroundColor: 'rgba(255,255,255,0.12)' }}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
        <Button label="Publier le statut" variant="cta" size="lg" onPress={publish} />
      </ScrollView>
      <UploadOverlay visible={uploading} progress={progress} label="Envoi du statut…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  voiceStage: { backgroundColor: dark.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  voiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: colors.mint },
  pickArea: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl },
  previewWrap: { flex: 1, padding: spacing.sm },
  preview: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  previewTop: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  captionWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  caption: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white, backgroundColor: 'rgba(16,37,44,0.45)', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 10 },
  panel: { maxHeight: 300, flexGrow: 0 },
});
