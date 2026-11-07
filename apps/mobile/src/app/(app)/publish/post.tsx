/**
 * Publication composer (W1.2: composable). One publication can hold text, photos or a video, a
 * voice (alone, or one narration over the photos with its « visite guidée »), and up to five of the
 * member's articles. Attachments come from a compact toolbar in thumb reach: Photos · Voix ·
 * Article. A video keeps its own sound: no voice while a video is attached (and the reverse).
 *
 * Entry points: the « + » menu (`?start=voice` opens the recorder, `?start=present` asks which
 * article to present), an article page (`?product=<id>` attaches it and opens the recorder), and
 * the community shortcuts (`?intent=`). The draft keeps everything, files included, across a
 * browser refresh.
 */
import { isPostIntent, POST_INTENTS, toFrenchError, VOICE_LANGUAGES, type Audience, type PostIntent } from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ImagePlus, Mic, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { VoicePreview } from '@/components/audio/Voice';
import { VoiceRecorderPanel } from '@/components/audio/VoiceRecorder';
import { ChoicePills, MediaPickerStrip, UploadOverlay } from '@/components/Composer';
import { Thumb } from '@/components/Media';
import { PublishHeader } from '@/components/PublishSwitcher';
import { Avatar, Button, colors, fonts, Screen, Sheet, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { createPost } from '@/lib/api/posts';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { deleteBlobs } from '@/lib/blobStore';
import { keepMediaForDraft, restoreDraftMedia } from '@/lib/draftFiles';
import { useDraft } from '@/lib/drafts';
import { pickMedia, uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';
import { keepForDraft, restoreVoice, uploadVoice, type RecordedClip, type VoiceAttachment } from '@/lib/voice';

const AUDIENCES: { key: Audience; label: string; a11y: string }[] = [
  { key: 'public', label: 'Tout le monde', a11y: 'Tout le monde' },
  { key: 'followers', label: 'Abonnés', a11y: 'Mes abonnés' },
  { key: 'friends', label: 'Amis', a11y: 'Mes amis' },
];
const LAST_LANGUAGE = 'voice:lastLanguage';
const NO_PRODUCTS: never[] = [];

export default function NewPost() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ intent?: string; start?: string; product?: string }>();
  const startIntent: PostIntent = isPostIntent(params.intent) ? params.intent : 'share';
  const presenting = params.start === 'present' || !!params.product;
  // « Demander à la communauté » shortcuts and article presentations keep their own draft, so a
  // restored photo post never replaces what the member just chose to start.
  const draftKey = presenting ? 'post-present' : startIntent === 'share' ? 'post' : `post-${startIntent}`;
  const draft = useDraft(draftKey, {
    body: '',
    visibility: 'public' as Audience,
    media: [] as LocalMedia[],
    voice: null as VoiceAttachment | null,
    productIds: (params.product ? [params.product] : []) as string[],
    intent: startIntent,
  });
  const { body, visibility, media, productIds } = draft.value;
  const voice = draft.value.voice ?? null;
  const intent: PostIntent = isPostIntent(draft.value.intent) ? draft.value.intent : 'share';
  const intentInfo = POST_INTENTS.find((i) => i.key === intent) ?? POST_INTENTS[0]!;
  const needsText = intent === 'seek' || intent === 'opinion';
  const set = (patch: Partial<typeof draft.value>) => draft.setValue((v) => ({ ...v, ...patch }));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(params.start === 'voice' || !!params.product);
  const [choosing, setChoosing] = useState(params.start === 'present' && !params.product);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const restoring = useRef(false);

  const myProducts = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });
  const products = myProducts.data ?? NO_PRODUCTS;
  const photos = media.filter((m) => m.kind === 'image');
  const hasVideo = media.some((m) => m.kind === 'video');

  // A restored draft: rebuild its files (web) or say which ones must be chosen again.
  useEffect(() => {
    if (!draft.restored || restoring.current) return;
    restoring.current = true;
    void (async () => {
      const [{ items, lost }, v] = await Promise.all([restoreDraftMedia(draft.value.media ?? []), restoreVoice(draft.value.voice)]);
      draft.setValue((d) => ({ ...d, media: items, voice: v }));
      if (lost > 0 || (draft.value.voice && !v)) toast('Une partie du brouillon n’a pas pu être récupérée : ajoutez-la à nouveau.', 'info');
    })();
  }, [draft.restored, draft, toast]);

  const canPublish = needsText ? body.trim().length > 0 : body.trim().length > 0 || media.length > 0 || !!voice;

  function changeMedia(next: LocalMedia[]) {
    // Narration cues point to photos: keep only those that still exist.
    const photoCount = next.filter((m) => m.kind === 'image').length;
    const cues = voice?.cues?.filter((c) => c.i < photoCount);
    set({ media: next, ...(voice ? { voice: { ...voice, cues: photoCount > 1 && cues && cues.length > 1 ? cues : undefined } } : {}) });
    void keepMediaForDraft(draftKey, next).then((kept) => draft.setValue((d) => ({ ...d, media: d.media.map((m) => kept.find((k) => k.uri === m.uri) ?? m) })));
  }

  async function addFromGallery() {
    try {
      const picked = await pickMedia({ allowVideo: !voice, multiple: true, limit: 10 - media.length });
      if (picked?.length) changeMedia([...media, ...picked].slice(0, 10));
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }

  async function useVoice(clip: RecordedClip) {
    const language = voice?.language ?? (await AsyncStorage.getItem(LAST_LANGUAGE).catch(() => null));
    const kept = await keepForDraft(draftKey, clip);
    set({ voice: { ...kept, language } });
    setRecording(false);
  }

  function setLanguage(language: string | null) {
    if (!voice) return;
    set({ voice: { ...voice, language } });
    if (language) void AsyncStorage.setItem(LAST_LANGUAGE, language).catch(() => {});
  }

  function toggleProduct(id: string) {
    const on = productIds.includes(id);
    set({ productIds: on ? productIds.filter((x) => x !== id) : [...productIds, id].slice(0, 5) });
  }

  async function publish() {
    if (!userId) return;
    abort.current = new AbortController();
    setUploading(true);
    setProgress(0);
    const bucket = visibility === 'public' ? 'public-media' : 'private-media';
    const share = voice ? 0.8 : 1;
    try {
      const uploaded = await uploadMediaBatch(userId, media.map((m) => ({ ...m, file: m.file instanceof Blob ? m.file : null })), {
        bucket,
        folder: 'posts',
        onProgress: (f) => setProgress(f * share),
        signal: abort.current.signal,
      });
      const voiceUp = voice ? await uploadVoice(userId, voice, { bucket, folder: 'voice', onProgress: (f) => setProgress(share + f * (1 - share)), signal: abort.current.signal }) : null;
      const id = await createPost({ body: body.trim(), visibility, media: voiceUp ? [...uploaded, voiceUp] : uploaded, productIds, intent });
      await draft.clear();
      void deleteBlobs(draftKey);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['user-posts', userId] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('Publication partagée', 'success');
      router.replace(`/post/${id}`);
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <PublishHeader
        mode="post"
        right={<Button label="Publier" size="sm" variant="cta" pill disabled={!canPublish} onPress={publish} style={{ height: 40, paddingHorizontal: 16 }} />}
      />
      <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {draft.restored ? (
          <Text variant="caption" tone="secondary">
            Brouillon restauré.{' '}
            <Text variant="caption" tone="accent" weight="700" onPress={() => (void draft.clear(), void deleteBlobs(draftKey))}>
              Effacer
            </Text>
          </Text>
        ) : null}
        <View style={styles.author}>
          <Avatar path={profile?.avatar_path} name={profile?.display_name ?? 'Moi'} size={48} />
          <Text variant="bodyStrong">{profile?.display_name}</Text>
        </View>

        <View style={styles.section}>
          <ChoicePills<PostIntent> value={intent} onChange={(k) => set({ intent: k })} options={POST_INTENTS.map((i) => ({ key: i.key, label: i.label }))} />
        </View>

        <TextInput
          value={body}
          onChangeText={(t) => set({ body: t })}
          placeholder={voice && !media.length ? 'Quelques mots sur votre message vocal (pour ceux qui ne peuvent pas écouter)…' : intentInfo.placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentDeep}
          multiline
          maxLength={2200}
          accessibilityLabel="Texte"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.text, focused && styles.textFocused, WEB_NO_OUTLINE]}
          autoFocus={!draft.restored && !recording && !choosing}
        />
        {needsText && (media.length > 0 || voice) && body.trim().length === 0 ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: -spacing.md }}>
            Ajoutez quelques mots : une photo seule ne dit pas ce que vous cherchez.
          </Text>
        ) : null}

        <MediaPickerStrip media={media} onChange={changeMedia} label="Photo ou vidéo" allowVideo={!voice} />
        {voice && !hasVideo ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: -spacing.md }}>
            Vidéo indisponible avec une voix : la vidéo garde son propre son.
          </Text>
        ) : null}

        {voice ? (
          <View style={styles.voiceCard} accessibilityLabel="Voix jointe">
            <View style={styles.voiceHead}>
              <Mic size={16} color={colors.accentDeep} />
              <Text variant="callout" weight="700">
                {photos.length > 0 ? 'Votre explication' : 'Votre message vocal'}
              </Text>
              {voice.cues && voice.cues.length > 1 ? (
                <Text variant="caption" tone="secondary">
                  · visite guidée
                </Text>
              ) : null}
            </View>
            <VoicePreview uri={voice.uri} durationMs={voice.durationMs} waveform={voice.waveform} />
            <Text variant="caption" weight="600" tone="secondary">
              Langue parlée (facultatif)
            </Text>
            <View style={styles.langs} accessibilityRole="radiogroup">
              {VOICE_LANGUAGES.map((l) => {
                const on = voice.language === l.key;
                return (
                  <Pressable key={l.key} onPress={() => setLanguage(on ? null : l.key)} style={[styles.lang, on && styles.langOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={l.label}>
                    <Text variant="caption" weight="700" color={on ? colors.night : colors.ink}>
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Refaire" size="sm" variant="outline" icon={RotateCcw} onPress={() => setRecording(true)} />
              <Button label="Retirer la voix" size="sm" variant="ghost" icon={Trash2} onPress={() => set({ voice: null })} />
            </View>
          </View>
        ) : null}

        {products.length > 0 ? (
          <View style={styles.section}>
            <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
              Identifier un article
              <Text variant="callout" tone="secondary" weight="400" style={{ fontSize: 13 }}>
                {productIds.length > 0 ? ` · ${productIds.length} sélectionné${productIds.length > 1 ? 's' : ''}` : ' · facultatif'}
              </Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {products.map((p) => {
                const on = productIds.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => toggleProduct(p.id)} style={[styles.product, on && styles.productOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={p.title}>
                    <Thumb media={p.media[0]} style={{ width: 92, height: 92, borderRadius: 12 }} />
                    <Text variant="caption" weight="600" numberOfLines={1} style={{ width: 92, fontSize: 12 }}>
                      {p.title}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Check size={14} color={colors.night} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
            Qui peut voir ?
          </Text>
          <ChoicePills<Audience> value={visibility} onChange={(v) => set({ visibility: v })} options={AUDIENCES} />
          {visibility !== 'public' ? (
            <Text variant="caption" tone="secondary">
              Médias privés. L’audience ne pourra plus être changée après publication.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Attachment toolbar, in thumb reach. */}
      <View style={styles.toolbar} accessibilityRole="toolbar" aria-label="Ajouter à la publication">
        <ToolButton icon={ImagePlus} label="Photos · vidéo" count={media.length} onPress={addFromGallery} disabled={media.length >= 10} />
        <ToolButton
          icon={Mic}
          label="Voix"
          count={voice ? 1 : 0}
          onPress={() => setRecording(true)}
          disabled={hasVideo}
          hint={hasVideo ? 'La vidéo garde son propre son' : photos.length > 1 ? 'Expliquez vos photos' : 'Jusqu’à 3 minutes'}
        />
        <ToolButton
          icon={ShoppingBag}
          label="Article"
          count={productIds.length}
          onPress={() => (products.length > 0 ? setChoosing(true) : router.push('/publish/listing'))}
          hint={products.length > 0 ? undefined : 'Créer un article'}
        />
      </View>

      <Sheet visible={recording} onClose={() => setRecording(false)} title={photos.length > 1 ? 'Expliquez vos photos' : 'Votre voix'}>
        <VoiceRecorderPanel photos={photos.length > 1 ? photos.map((p) => p.posterUri ?? p.uri) : undefined} onUse={useVoice} onCancel={() => setRecording(false)} useLabel={voice ? 'Remplacer' : 'Ajouter'} />
      </Sheet>

      <Sheet visible={choosing} onClose={() => setChoosing(false)} title={params.start === 'present' ? 'Quel article présenter ?' : 'Identifier un article'} scroll>
        {products.map((p) => {
          const on = productIds.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (params.start === 'present') {
                  set({ productIds: on ? productIds : [p.id, ...productIds].slice(0, 5) });
                  setChoosing(false);
                  setRecording(true);
                } else toggleProduct(p.id);
              }}
              style={[styles.pickRow, on && styles.pickRowOn]}
              accessibilityRole={params.start === 'present' ? 'button' : 'checkbox'}
              accessibilityState={{ checked: on }}
              accessibilityLabel={params.start === 'present' ? `Présenter ${p.title}` : p.title}
            >
              <Thumb media={p.media[0]} style={{ width: 52, height: 52, borderRadius: 10 }} />
              <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {p.title}
              </Text>
              {on ? <Check size={18} color={colors.accentDeep} /> : null}
            </Pressable>
          );
        })}
        {params.start !== 'present' ? <Button label="Terminé" variant="primary" onPress={() => setChoosing(false)} style={{ marginTop: spacing.md }} /> : null}
      </Sheet>

      <UploadOverlay visible={uploading} progress={progress} label="Publication en cours…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

function ToolButton({ icon: Icon, label, count, onPress, disabled, hint }: { icon: typeof Mic; label: string; count: number; onPress: () => void; disabled?: boolean; hint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.surfaceSubtle }, disabled && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} ajouté${count > 1 ? 's' : ''}` : label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <View>
        <Icon size={22} color={colors.ink} />
        {count > 0 ? (
          <View style={styles.toolBadge}>
            <Text variant="micro" weight="800" color={colors.night} style={{ fontSize: 10, lineHeight: 12 }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="micro" weight="700" color={colors.ink} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Lovable: a large white rounded text area with no visible border until focus.
  text: { minHeight: 128, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, padding: spacing.lg, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink, textAlignVertical: 'top' },
  // Lovable `focus:ring-2 ring-lab-mint`
  textFocused: { borderColor: colors.mint },
  section: { gap: spacing.sm },
  product: { padding: 6, borderRadius: 16, backgroundColor: colors.surface, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  productOn: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  voiceCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  voiceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lang: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  langOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  toolbar: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  tool: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3 },
  toolBadge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: 12, minHeight: 56 },
  pickRowOn: { backgroundColor: colors.mintSoft },
});
