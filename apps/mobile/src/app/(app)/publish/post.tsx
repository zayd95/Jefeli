/**
 * Publication editor (W1.3): the content makes the layout. No form, no type selector.
 *
 * - Nothing yet → a writing canvas, in the serif of the feed's text cards.
 * - Photos (or a video) → the canvas becomes the preview, rendered by the feed's own component
 *   (PostMedia): same narration control, same photo navigation following the « visite guidée »,
 *   same article chip. The gallery below reorders by dragging (or with buttons).
 * - A voice alone → the feed's voice card, with redo, language and a few words for those who
 *   can't listen.
 * - Voix opens the full-screen studio at once; with photos, the member taps the photo they talk
 *   about.
 *
 * Type (Je partage ▾) and audience (Tout le monde ▾) are small pills. The draft keeps everything,
 * files included, and is never replaced silently: with a draft present, the editor first asks
 * « Continuer » or « Nouvelle publication » (unless the « + » menu already asked).
 *
 * Entry points: the « + » menu (`?draft=continue|new`), an article page (`?product=<id>`: the
 * article is linked and the studio opens), `?start=present` (choose an article to present),
 * `?start=voice`, and the community shortcuts (`?intent=`).
 */
import { formatDuration, isPostIntent, POST_INTENTS, toFrenchError, VOICE_LANGUAGES, voiceLanguageLabel, type Audience, type PostIntent } from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, ImagePlus, Languages, Mic, RotateCcw, ShoppingBag, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { VoiceCard, voiceSummary } from '@/components/audio/Voice';
import { VoiceStudio } from '@/components/audio/VoiceStudio';
import { UploadOverlay } from '@/components/Composer';
import { DraftChoice } from '@/components/DraftChoice';
import { Thumb } from '@/components/Media';
import { PostMedia } from '@/components/PostMedia';
import { PriceLabel } from '@/components/PriceLabel';
import { ReorderStrip } from '@/components/ReorderStrip';
import { Button, colors, dark, fonts, IconButton, InlineRetry, Screen, Sheet, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { createPost } from '@/lib/api/posts';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { keepMediaForDraft, restoreDraftMedia } from '@/lib/draftFiles';
import { discardDraft, useDraft, useDraftGate } from '@/lib/drafts';
import { goBack } from '@/lib/nav';
import type { MediaRow, TaggedProduct } from '@/lib/types';
import { pickMedia, uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';
import { keepForDraft, restoreVoice, uploadVoice, type NarrationCue, type RecordedClip, type VoiceAttachment } from '@/lib/voice';

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'public', label: 'Tout le monde' },
  { key: 'followers', label: 'Mes abonnés' },
  { key: 'friends', label: 'Mes amis' },
];
const LAST_LANGUAGE = 'voice:lastLanguage';
const NO_PRODUCTS: never[] = [];
type Params = { intent?: string; start?: string; product?: string; draft?: string };

export default function NewPost() {
  const params = useLocalSearchParams<Params>();
  const gate = useDraftGate('post', params.draft);
  if (gate.phase === 'ready') return <PostEditor params={params} continued={!!gate.summary} />;
  return (
    <Screen edges={['top', 'bottom']} background={dark.background}>
      <View style={styles.top}>
        <IconButton icon={X} label="Fermer" variant="glass" color={dark.text} onPress={() => goBack()} />
      </View>
      {gate.phase === 'ask' && gate.summary ? (
        <View style={styles.gate}>
          <DraftChoice kind="post" tone="dark" summary={gate.summary} onContinue={gate.continueDraft} onNew={gate.startNew} />
        </View>
      ) : null}
    </Screen>
  );
}

/** Photo index (among images) → new index, after moving item `from` to `to` in the media list. */
function remapCues(cues: NarrationCue[] | undefined, before: LocalMedia[], after: LocalMedia[]): NarrationCue[] | undefined {
  if (!cues) return undefined;
  const oldImages = before.filter((m) => m.kind === 'image');
  const newImages = after.filter((m) => m.kind === 'image');
  const next: NarrationCue[] = [];
  for (const c of cues) {
    const item = oldImages[c.i];
    const i = item ? newImages.indexOf(item) : -1;
    if (i < 0) continue; // the photo was removed
    if (next[next.length - 1]?.i === i) continue;
    next.push({ t: c.t, i });
  }
  return next.length > 1 ? next : undefined;
}

function PostEditor({ params, continued }: { params: Params; continued: boolean }) {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const startIntent: PostIntent = isPostIntent(params.intent) ? params.intent : 'share';
  const draftKey = 'post';
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
  const [failed, setFailed] = useState<string | null>(null);
  const [studio, setStudio] = useState(params.start === 'voice' || (!!params.product && !continued));
  const [choosing, setChoosing] = useState(params.start === 'present' && !params.product);
  const [sheet, setSheet] = useState<null | 'audience' | 'type' | 'language' | 'products'>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const restoring = useRef(false);

  const myProducts = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });
  const products = myProducts.data ?? NO_PRODUCTS;
  const photos = media.filter((m) => m.kind === 'image');
  const hasVideo = media.some((m) => m.kind === 'video');
  const linked = productIds.map((id) => products.find((p) => p.id === id)).filter((p): p is (typeof products)[number] => !!p);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_LANGUAGE).then((l) => setPendingLanguage((cur) => cur ?? l));
  }, []);

  // A restored draft: rebuild its files (web) or say which ones must be chosen again. Continuing
  // from an article page links that article too.
  useEffect(() => {
    if (!draft.restored || restoring.current) return;
    restoring.current = true;
    void (async () => {
      const [{ items, lost }, v] = await Promise.all([restoreDraftMedia(draft.value.media ?? []), restoreVoice(draft.value.voice)]);
      draft.setValue((d) => ({
        ...d,
        media: items,
        voice: v,
        productIds: params.product && !d.productIds.includes(params.product) ? [...d.productIds, params.product].slice(0, 5) : d.productIds,
      }));
      if (lost > 0 || (draft.value.voice && !v)) toast('Une partie du brouillon n’a pas pu être récupérée : ajoutez-la à nouveau.', 'info');
    })();
  }, [draft.restored, draft, toast, params.product]);

  const canPublish = needsText ? body.trim().length > 0 : body.trim().length > 0 || media.length > 0 || !!voice;

  // The preview is built from the same rows the feed reads after publication.
  const previewRows: MediaRow[] = useMemo(
    () =>
      media.map((m, i) => ({
        id: `${m.uri}-${i}`,
        kind: m.kind,
        storage_path: '',
        poster_path: null,
        width: m.width,
        height: m.height,
        duration_ms: m.durationMs ?? null,
        position: i,
        local_uri: m.uri,
        local_poster: m.posterUri ?? null,
      })),
    [media],
  );
  const previewProduct: TaggedProduct | null = linked[0]
    ? { ...linked[0], media: linked[0].media.map((x) => ({ storage_path: x.storage_path, kind: x.kind, poster_path: x.poster_path, position: x.position })) }
    : null;

  function keepFiles(next: LocalMedia[]) {
    void keepMediaForDraft(draftKey, next).then((kept) => draft.setValue((d) => ({ ...d, media: d.media.map((m) => kept.find((k) => k.uri === m.uri) ?? m) })));
  }

  function setMedia(next: LocalMedia[]) {
    set({ media: next, ...(voice ? { voice: { ...voice, cues: remapCues(voice.cues, media, next) } } : {}) });
    keepFiles(next);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= media.length || from === to) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setMedia(next);
  }

  async function addMedia() {
    try {
      const picked = await pickMedia({ allowVideo: !voice, multiple: true, limit: 10 - media.length });
      if (picked?.length) setMedia([...media, ...picked].slice(0, 10));
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }

  async function useVoice(clip: RecordedClip) {
    const kept = await keepForDraft(draftKey, clip);
    set({ voice: { ...kept, language: pendingLanguage } });
    setStudio(false);
  }

  function setLanguage(language: string | null) {
    setPendingLanguage(language);
    if (voice) set({ voice: { ...voice, language } });
    if (language) void AsyncStorage.setItem(LAST_LANGUAGE, language).catch(() => {});
  }

  function toggleProduct(id: string) {
    const on = productIds.includes(id);
    set({ productIds: on ? productIds.filter((x) => x !== id) : [...productIds, id].slice(0, 5) });
  }

  async function publish() {
    if (!userId || !canPublish) return;
    abort.current = new AbortController();
    setUploading(true);
    setFailed(null);
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
      void discardDraft('post');
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['user-posts', userId] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('Publication partagée', 'success');
      router.replace(`/post/${id}`);
    } catch (e) {
      // The draft stays as it was: « Réessayer » sends it again.
      const message = e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e);
      setFailed(message);
    } finally {
      setUploading(false);
    }
  }

  const contentWidth = Math.min(screenWidth, 640) - spacing.lg * 2;
  const stage = media.length > 0 ? 'media' : voice ? 'voice' : 'write';
  const firstCue = (i: number) => {
    const c = voice?.cues?.find((x) => x.i === photos.indexOf(media[i]!));
    return c && media[i]?.kind === 'image' ? formatDuration(c.t) : null;
  };
  const audienceLabel = AUDIENCES.find((a) => a.key === visibility)?.label ?? 'Tout le monde';
  const initials = (profile?.display_name ?? 'Moi')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const typePill = (
    <Pressable onPress={() => setSheet('type')} style={styles.typePill} accessibilityRole="button" accessibilityLabel={`Type de publication : ${intentInfo.label}. Changer`}>
      <Text variant="caption" weight="700" tone="mint">
        {intentInfo.label}
      </Text>
      <ChevronDown size={14} color={dark.mint} />
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom']} background={dark.background} keyboard>
      <View style={styles.top}>
        <IconButton icon={X} label="Fermer" variant="glass" color={dark.text} onPress={() => goBack()} />
        <Pressable onPress={() => setSheet('audience')} style={styles.audience} accessibilityRole="button" accessibilityLabel={`Audience : ${audienceLabel.toLowerCase()}. Changer`}>
          <View style={styles.initials}>
            <Text weight="800" color={colors.ink} style={{ fontSize: 11, lineHeight: 14 }}>
              {initials}
            </Text>
          </View>
          <Text variant="caption" weight="700" tone="fog">
            {audienceLabel}
          </Text>
          <ChevronDown size={14} color={dark.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Button label="Publier" size="sm" variant="cta" pill disabled={!canPublish} onPress={publish} style={{ height: 40, paddingHorizontal: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {failed ? <InlineRetry tone="dark" message={/brouillon/i.test(failed) ? `Publication non envoyée : ${failed}` : `Publication non envoyée : ${failed} Votre brouillon est gardé.`} onRetry={publish} retrying={uploading} /> : null}

        {stage === 'write' ? (
          <View style={styles.canvas}>
            <TextInput
              value={body}
              onChangeText={(t) => set({ body: t })}
              placeholder={intentInfo.placeholder}
              placeholderTextColor={dark.textTertiary}
              selectionColor={colors.mint}
              multiline
              maxLength={2200}
              accessibilityLabel="Texte de la publication"
              style={[styles.canvasText, WEB_NO_OUTLINE]}
              autoFocus={!continued && !studio && !choosing}
            />
            <View style={styles.canvasFoot}>{typePill}</View>
          </View>
        ) : stage === 'voice' ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ marginHorizontal: -spacing.lg }}>
              <VoiceCard uri={voice!.uri} durationMs={voice!.durationMs} waveform={voice!.waveform} language={voice!.language} />
            </View>
            <View style={styles.voiceActions}>
              <Button label="Refaire" size="sm" variant="outlineDark" pill icon={RotateCcw} onPress={() => setStudio(true)} />
              <Button label={voiceLanguageLabel(voice!.language) ?? 'Langue'} size="sm" variant="outlineDark" pill icon={Languages} onPress={() => setSheet('language')} accessibilityLabel={`Langue parlée : ${voiceLanguageLabel(voice!.language) ?? 'non précisée'}. Changer`} />
              <Button label="Supprimer" size="sm" variant="ghostDark" pill icon={Trash2} onPress={() => set({ voice: null })} accessibilityLabel="Supprimer la voix" />
            </View>
            <View style={styles.captionRow}>
              <TextInput
                value={body}
                onChangeText={(t) => set({ body: t })}
                placeholder="Quelques mots pour ceux qui ne peuvent pas écouter"
                placeholderTextColor={dark.textTertiary}
                selectionColor={colors.mint}
                multiline
                maxLength={2200}
                accessibilityLabel="Texte de la publication"
                style={[styles.caption, WEB_NO_OUTLINE]}
              />
              {typePill}
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.preview}>
              <PostMedia
                visual={previewRows}
                voice={voice ? { uri: voice.uri, durationMs: voice.durationMs, waveform: voice.waveform, language: voice.language, cues: voice.cues } : null}
                product={previewProduct}
                bucket="public-media"
                width={contentWidth}
              />
            </View>
            {voice ? (
              <View style={styles.narration}>
                <Mic size={16} color={dark.mint} />
                <Text variant="caption" weight="700" tone="fog" style={{ flex: 1 }} numberOfLines={2}>
                  {`Votre explication · ${voiceSummary(voice.language, voice.durationMs)}${voice.cues && voice.cues.length > 1 ? ' · visite guidée' : ''}`}
                </Text>
                <IconButton icon={RotateCcw} label="Refaire l’explication" size={18} color={dark.text} onPress={() => setStudio(true)} />
                <IconButton icon={Languages} label={`Langue parlée : ${voiceLanguageLabel(voice.language) ?? 'non précisée'}. Changer`} size={18} color={dark.text} onPress={() => setSheet('language')} />
                <IconButton icon={Trash2} label="Retirer l’explication" size={18} color={dark.text} onPress={() => set({ voice: null })} />
              </View>
            ) : null}
            <ReorderStrip
              items={media.map((m, i) => ({ key: `${m.uri}-${i}`, uri: m.kind === 'image' ? m.uri : (m.posterUri ?? null), kind: m.kind, cue: firstCue(i) }))}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
              onRemove={(i) => setMedia(media.filter((_, j) => j !== i))}
              onAdd={addMedia}
            />
            <View style={styles.captionRow}>
              <TextInput
                value={body}
                onChangeText={(t) => set({ body: t })}
                placeholder="Ajouter une légende…"
                placeholderTextColor={dark.textTertiary}
                selectionColor={colors.mint}
                multiline
                maxLength={2200}
                accessibilityLabel="Légende"
                style={[styles.caption, WEB_NO_OUTLINE]}
              />
              {typePill}
            </View>
          </View>
        )}

        {needsText && (media.length > 0 || voice) && body.trim().length === 0 ? (
          <Text variant="caption" tone="gold">
            Ajoutez quelques mots : une photo seule ne dit pas ce que vous cherchez.
          </Text>
        ) : null}

        {linked.map((p) => (
          <View key={p.id} style={styles.linked}>
            <Thumb media={p.media[0]} style={{ width: 44, height: 44, borderRadius: 10 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="callout" weight="700" tone="fog" numberOfLines={1}>
                {p.title}
              </Text>
              <PriceLabel product={p} size="card" tone="dark" />
            </View>
            <IconButton icon={X} label={`Retirer l’article ${p.title}`} size={18} color={dark.textSecondary} onPress={() => toggleProduct(p.id)} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.toolbar} accessibilityRole="toolbar" aria-label="Ajouter à la publication">
        <ToolButton icon={ImagePlus} label="Média" count={media.length} onPress={addMedia} disabled={media.length >= 10} />
        <ToolButton
          icon={Mic}
          label={voice ? 'Voix ✓' : 'Voix'}
          a11y={voice ? 'Voix, message vocal ajouté' : 'Voix'}
          onPress={() => setStudio(true)}
          disabled={hasVideo}
          hint={hasVideo ? 'La vidéo garde son propre son' : photos.length > 1 ? 'Expliquez vos photos' : 'Jusqu’à 3 minutes'}
        />
        <ToolButton
          icon={ShoppingBag}
          label="Article"
          count={productIds.length}
          onPress={() => (products.length > 0 ? setSheet('products') : router.push('/publish/listing'))}
          hint={products.length > 0 ? undefined : 'Créer un article'}
        />
      </View>

      <VoiceStudio
        visible={studio}
        title={photos.length > 1 ? 'Expliquez vos photos' : linked[0] ? `Présenter ${linked[0].title}` : 'Votre message vocal'}
        photos={photos.length > 1 ? photos.map((p) => p.posterUri ?? p.uri) : undefined}
        language={voice?.language ?? pendingLanguage}
        onLanguage={setLanguage}
        onDone={useVoice}
        onClose={() => setStudio(false)}
        avatar={{ path: profile?.avatar_path, name: profile?.display_name ?? 'Moi' }}
      />

      <Sheet visible={sheet === 'audience'} onClose={() => setSheet(null)} title="Qui peut voir ?" tone="dark">
        {AUDIENCES.map((a) => (
          <SheetChoice key={a.key} label={a.label} on={visibility === a.key} onPress={() => (set({ visibility: a.key }), setSheet(null))} />
        ))}
        <Text variant="caption" tone="fogSecondary" style={{ marginTop: spacing.sm }}>
          {visibility === 'public' ? 'Visible dans le fil et sur votre profil.' : 'Médias privés. L’audience ne pourra plus être changée après publication.'}
        </Text>
      </Sheet>

      <Sheet visible={sheet === 'type'} onClose={() => setSheet(null)} title="Type de publication" tone="dark">
        {POST_INTENTS.map((i) => (
          <SheetChoice key={i.key} label={i.label} hint={i.hint} on={intent === i.key} onPress={() => (set({ intent: i.key }), setSheet(null))} />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'language'} onClose={() => setSheet(null)} title="Langue parlée" tone="dark">
        {VOICE_LANGUAGES.map((l) => (
          <SheetChoice key={l.key} label={l.label} on={(voice?.language ?? null) === l.key} onPress={() => (setLanguage(voice?.language === l.key ? null : l.key), setSheet(null))} />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'products' || choosing} onClose={() => (setSheet(null), setChoosing(false))} title={choosing ? 'Quel article présenter ?' : 'Lier un article'} scroll tone="dark">
        {products.map((p) => {
          const on = productIds.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (choosing) {
                  set({ productIds: on ? productIds : [p.id, ...productIds].slice(0, 5) });
                  setChoosing(false);
                  setStudio(true);
                } else toggleProduct(p.id);
              }}
              style={[styles.pickRow, on && styles.pickRowOn]}
              accessibilityRole={choosing ? 'button' : 'checkbox'}
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={choosing ? `Présenter ${p.title}` : p.title}
            >
              <Thumb media={p.media[0]} style={{ width: 52, height: 52, borderRadius: 10 }} />
              <Text variant="bodyStrong" tone="fog" numberOfLines={1} style={{ flex: 1 }}>
                {p.title}
              </Text>
              {on ? <Check size={18} color={dark.mint} /> : null}
            </Pressable>
          );
        })}
        {!choosing ? <Button label="Terminé" variant="cta" pill onPress={() => setSheet(null)} style={{ marginTop: spacing.md }} /> : null}
      </Sheet>

      <UploadOverlay visible={uploading} progress={progress} label="Publication en cours…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

function SheetChoice({ label, hint, on, onPress }: { label: string; hint?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pickRow, on && styles.pickRowOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" tone="fog">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="fogSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      {on ? <Check size={18} color={dark.mint} /> : null}
    </Pressable>
  );
}

function ToolButton({ icon: Icon, label, a11y, count = 0, onPress, disabled, hint }: { icon: typeof Mic; label: string; a11y?: string; count?: number; onPress: () => void; disabled?: boolean; hint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: dark.subtle }, disabled && { opacity: 0.4 }]}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? (count > 0 ? `${label}, ${count} ajouté${count > 1 ? 's' : ''}` : label)}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <View>
        <Icon size={22} color={dark.text} />
        {count > 0 ? (
          <View style={styles.toolBadge}>
            <Text variant="micro" weight="800" color={colors.night} style={{ fontSize: 10, lineHeight: 12 }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="micro" weight="700" tone="fog" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 4, paddingRight: 12, borderRadius: 18, borderWidth: 1, borderColor: dark.borderStrong, backgroundColor: dark.subtle },
  initials: { width: 28, height: 28, borderRadius: 14, backgroundColor: dark.text, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  // The writing canvas looks like the feed's text card: deep surface, gold hairline, serif words.
  canvas: { minHeight: 260, borderRadius: 24, borderWidth: 1, borderColor: dark.goldLine, backgroundColor: dark.surface, padding: 20, gap: spacing.md },
  canvasText: { flex: 1, minHeight: 190, fontFamily: fonts.serif, fontSize: 22, lineHeight: 30, color: dark.text, textAlignVertical: 'top' },
  canvasFoot: { flexDirection: 'row', justifyContent: 'flex-end' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: dark.mintLine, backgroundColor: dark.mintSoft },
  preview: { borderRadius: 24, overflow: 'hidden', backgroundColor: dark.surface, alignSelf: 'center' },
  narration: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, borderRadius: 16, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.mintLine },
  voiceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  captionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: dark.border },
  caption: { flex: 1, minHeight: 44, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: dark.text, paddingVertical: 10, textAlignVertical: 'top' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 8, paddingLeft: 10, borderRadius: 18, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.mintLine },
  toolbar: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderTopWidth: 1, borderColor: dark.border, backgroundColor: dark.background },
  tool: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3 },
  toolBadge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 12, minHeight: 56 },
  pickRowOn: { backgroundColor: dark.mintSelected },
});
