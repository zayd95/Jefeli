/**
 * Article editor (W1.3): a shop window, not a form.
 *
 * - The cover comes first, rendered by the same media block as the article page (PostMedia), so
 *   the seller sees what buyers will see; the gallery reorders by dragging or with buttons.
 * - Name and price are written in large type on the window itself; Vendre · Wecci (troc) · Les deux.
 * - « Présenter en voix »: the same full-screen studio as publications; with several photos the
 *   seller taps the one being described. The voice is stored with the article (product_media,
 *   kind 'audio'): no publication is created behind the seller's back.
 * - The details (catégorie, état, lieu, remise, description, quantité) are summary pills that open
 *   one sheet. A required pill that is empty turns gold, and « Mettre en vente » says what is
 *   missing before sending anything.
 *
 * Kept from before: the same required fields and messages, create_listing's server rules (a price
 * only for « Prix affiché » sales, none ever stored for « Sur demande »), upload progress with
 * automatic retry and cancel, the optional feed share (now carrying the voice too), and the local
 * draft — files and voice included — which is never replaced silently.
 */
import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  DELIVERY_LABELS,
  formatAmountInput,
  formatDuration,
  isPriceMode,
  parseXOF,
  toFrenchError,
  voiceLanguageLabel,
  VOICE_LANGUAGES,
  type ItemCondition,
  type ListingMode,
  type PriceMode,
} from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, ImagePlus, Languages, Mic, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { voiceSummary } from '@/components/audio/Voice';
import { VoiceStudio } from '@/components/audio/VoiceStudio';
import { UploadOverlay } from '@/components/Composer';
import { DraftChoice } from '@/components/DraftChoice';
import { LocationPicker } from '@/components/LocationPicker';
import { PostMedia } from '@/components/PostMedia';
import { ReorderStrip } from '@/components/ReorderStrip';
import { Button, Chip, colors, Field, fonts, IconButton, InlineRetry, radius, Screen, Sheet, spacing, Text, Toggle, useToast, WEB_NO_OUTLINE } from '@/design';
import { createPost } from '@/lib/api/posts';
import { createListing, fetchCategories } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { keepMediaForDraft, restoreDraftMedia } from '@/lib/draftFiles';
import { discardDraft, useDraft, useDraftGate } from '@/lib/drafts';
import { goBack } from '@/lib/nav';
import type { MediaRow } from '@/lib/types';
import { pickMedia, uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';
import { keepForDraft, restoreVoice, uploadVoice, type NarrationCue, type RecordedClip, type VoiceAttachment } from '@/lib/voice';

const MODES: { key: ListingMode; label: string }[] = [
  { key: 'sale', label: 'Vendre' },
  { key: 'trade', label: 'Wecci (troc)' },
  { key: 'sale_or_trade', label: 'Les deux' },
];
const PRICES: { key: PriceMode; label: string; a11y: string; hint: string }[] = [
  { key: 'fixed', label: 'Prix affiché', a11y: 'Prix affiché', hint: 'Le prix est visible par tous.' },
  { key: 'negotiable', label: 'À discuter', a11y: 'À discuter', hint: 'Un prix indicatif, ouvert aux offres.' },
  { key: 'on_request', label: 'Sur demande', a11y: 'Prix sur demande', hint: 'Aucun prix affiché : les acheteurs vous écrivent.' },
];
const LAST_LANGUAGE = 'voice:lastLanguage';
type Params = { draft?: string };

export default function NewListing() {
  const params = useLocalSearchParams<Params>();
  const gate = useDraftGate('listing', params.draft);
  if (gate.phase === 'ready') return <ListingEditor continued={!!gate.summary} />;
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton icon={X} label="Fermer" onPress={() => goBack()} />
      </View>
      {gate.phase === 'ask' && gate.summary ? (
        <View style={styles.gate}>
          <DraftChoice kind="listing" summary={gate.summary} onContinue={gate.continueDraft} onNew={gate.startNew} />
        </View>
      ) : null}
    </Screen>
  );
}

/** Narration cues follow their photos when the gallery is reordered or a photo removed. */
function remapCues(cues: NarrationCue[] | undefined, before: LocalMedia[], after: LocalMedia[]): NarrationCue[] | undefined {
  if (!cues) return undefined;
  const oldImages = before.filter((m) => m.kind === 'image');
  const newImages = after.filter((m) => m.kind === 'image');
  const next: NarrationCue[] = [];
  for (const c of cues) {
    const item = oldImages[c.i];
    const i = item ? newImages.indexOf(item) : -1;
    if (i < 0 || next[next.length - 1]?.i === i) continue;
    next.push({ t: c.t, i });
  }
  return next.length > 1 ? next : undefined;
}

function ListingEditor({ continued }: { continued: boolean }) {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const draftKey = 'listing';
  const draft = useDraft(draftKey, {
    media: [] as LocalMedia[],
    voice: null as VoiceAttachment | null,
    title: '',
    description: '',
    price: '',
    priceMode: 'fixed' as PriceMode,
    mode: 'sale' as ListingMode,
    category: '',
    condition: 'new' as ItemCondition,
    quantity: 1,
    city: profile?.city ?? 'Dakar',
    neighborhood: profile?.neighborhood ?? '',
    delivery: ['pickup'] as string[],
    deliveryNotes: '',
    alsoPost: true,
  });
  const v = draft.value;
  const voice = v.voice ?? null;
  const priceMode: PriceMode = isPriceMode(v.priceMode) ? v.priceMode : 'fixed';
  const set = (patch: Partial<typeof v>) => draft.setValue((cur) => ({ ...cur, ...patch }));
  const [sheet, setSheet] = useState<null | 'details' | 'price' | 'language'>(null);
  const [studio, setStudio] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const restoring = useRef(false);
  const askedForMedia = useRef(false);
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });

  const photos = v.media.filter((m) => m.kind === 'image');
  const hasVideo = v.media.some((m) => m.kind === 'video');
  const isTrade = v.mode === 'trade';
  const price = parseXOF(v.price);
  // What is sent: no hidden price for « Sur demande »; trade listings may carry a value.
  const sentPrice = !isTrade && priceMode === 'on_request' ? null : price && price > 0 ? price : null;
  const errors = {
    media: v.media.length === 0 ? 'Ajoutez au moins une photo ou une vidéo.' : null,
    title: v.title.trim().length < 3 ? 'Donnez un nom (3 caractères minimum).' : null,
    price: !isTrade && priceMode === 'fixed' && !sentPrice ? 'Indiquez un prix, ou choisissez « Sur demande » ou « À discuter ».' : null,
    category: !v.category ? 'Choisissez une catégorie.' : null,
    city: !v.city.trim() ? 'Indiquez une ville.' : null,
    delivery: v.delivery.length === 0 ? 'Choisissez au moins un mode de remise.' : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);
  const missing = (Object.keys(errors) as (keyof typeof errors)[]).filter((k) => errors[k]);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_LANGUAGE).then((l) => setPendingLanguage((cur) => cur ?? l));
  }, []);

  // A restored draft: rebuild its files and voice (web) or say what must be chosen again.
  useEffect(() => {
    if (!draft.restored || restoring.current) return;
    restoring.current = true;
    void (async () => {
      const [{ items, lost }, restoredVoice] = await Promise.all([restoreDraftMedia(draft.value.media ?? []), restoreVoice(draft.value.voice)]);
      draft.setValue((d) => ({ ...d, media: items, voice: restoredVoice }));
      if (lost > 0 || (draft.value.voice && !restoredVoice)) toast('Une partie du brouillon n’a pas pu être récupérée : ajoutez-la à nouveau.', 'info');
    })();
  }, [draft.restored, draft, toast]);

  // « Article ouvre d’abord la galerie »: on phones, straight to the gallery for a new article.
  // (Browsers only open a file chooser from a tap, so the web shows the big « Ajouter » tile.)
  useEffect(() => {
    if (Platform.OS === 'web' || continued || askedForMedia.current) return;
    askedForMedia.current = true;
    void addMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: MediaRow[] = useMemo(
    () =>
      v.media.map((m, i) => ({
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
    [v.media],
  );

  function setMedia(next: LocalMedia[]) {
    set({ media: next, ...(voice ? { voice: { ...voice, cues: remapCues(voice.cues, v.media, next) } } : {}) });
    void keepMediaForDraft(draftKey, next).then((kept) => draft.setValue((d) => ({ ...d, media: d.media.map((m) => kept.find((k) => k.uri === m.uri) ?? m) })));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= v.media.length || from === to) return;
    const next = [...v.media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setMedia(next);
  }

  async function addMedia() {
    try {
      const picked = await pickMedia({ allowVideo: !voice, multiple: true, limit: 10 - v.media.length });
      if (picked?.length) setMedia([...v.media, ...picked].slice(0, 10));
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

  async function publish() {
    if (missing.length > 0) {
      setShowErrors(true);
      const labels: Record<keyof typeof errors, string> = { media: 'une photo', title: 'le nom', price: 'le prix', category: 'la catégorie', city: 'la ville', delivery: 'la remise' };
      toast(`À compléter : ${missing.map((k) => labels[k]).join(', ')}`, 'error');
      return;
    }
    if (!userId) return;
    abort.current = new AbortController();
    setUploading(true);
    setFailed(null);
    setProgress(0);
    const share = voice ? 0.85 : 1;
    try {
      const uploaded = await uploadMediaBatch(userId, v.media.map((m) => ({ ...m, file: m.file instanceof Blob ? m.file : null })), {
        bucket: 'public-media',
        folder: 'listings',
        onProgress: (f) => setProgress(f * share),
        signal: abort.current.signal,
      });
      const voiceUp = voice ? await uploadVoice(userId, voice, { bucket: 'public-media', folder: 'listings', onProgress: (f) => setProgress(share + f * (1 - share)), signal: abort.current.signal }) : null;
      const id = await createListing(
        {
          title: v.title.trim(),
          description: v.description.trim(),
          price_xof: sentPrice,
          price_mode: isTrade ? 'fixed' : priceMode,
          category_slug: v.category,
          condition: v.condition,
          listing_mode: v.mode,
          quantity: v.quantity,
          city: v.city.trim(),
          neighborhood: v.neighborhood.trim(),
          delivery_options: v.delivery,
          delivery_notes: v.deliveryNotes.trim(),
        },
        uploaded,
        voiceUp,
      );
      let shared = true;
      if (v.alsoPost) {
        // Same files, no second upload: also shared in the feed, tagged, with the same voice.
        shared = await createPost({ body: v.title.trim(), visibility: 'public', media: voiceUp ? [...uploaded, voiceUp] : uploaded, productIds: [id] })
          .then(() => true)
          .catch(() => false);
      }
      await draft.clear();
      void discardDraft('listing');
      qc.invalidateQueries({ queryKey: ['seller-products', userId] });
      qc.invalidateQueries({ queryKey: ['my-active-products', userId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['explore'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      // Partial failure is said plainly: the article exists, the feed share did not go out.
      if (shared) toast('Article mis en vente dans votre boutique', 'success');
      else toast('Article publié dans votre boutique, mais le partage dans votre fil a échoué. Vous pourrez le partager depuis une publication.', 'error');
      router.replace(`/p/${id}`);
    } catch (e) {
      // The draft is kept: nothing typed, picked or recorded is lost; « Réessayer » sends it again.
      const message = e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e);
      setFailed(message);
    } finally {
      setUploading(false);
    }
  }

  const cats = categories.data ?? [];
  const category = cats.find((c) => c.slug === v.category);
  const coverWidth = Math.min(screenWidth, 640) - spacing.lg * 2;
  const priceInfo = PRICES.find((p) => p.key === priceMode)!;
  const pills: { key: string; label: string; value: string | null; required?: boolean; error?: string | null }[] = [
    { key: 'category', label: 'Catégorie', value: category?.name ?? null, required: true, error: err('category') },
    { key: 'condition', label: 'État', value: CONDITION_LABELS[v.condition], required: true },
    { key: 'city', label: 'Lieu', value: [v.city, v.neighborhood].filter(Boolean).join(' · ') || null, required: true, error: err('city') },
    { key: 'delivery', label: 'Remise', value: v.delivery.map((d) => DELIVERY_LABELS[d] ?? d).join(', ') || null, required: true, error: err('delivery') },
    { key: 'description', label: 'Description', value: v.description.trim() ? `${v.description.trim().slice(0, 24)}${v.description.trim().length > 24 ? '…' : ''}` : null },
    { key: 'quantity', label: 'Quantité', value: String(v.quantity) },
  ];

  return (
    <Screen edges={['top']} keyboard>
      <View style={styles.top}>
        <IconButton icon={X} label="Fermer" onPress={() => goBack()} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" accessibilityRole="header">
            Nouvel article
          </Text>
          <Text variant="caption" tone="secondary">
            {v.media.length || v.title ? 'Brouillon enregistré' : 'Tel que l’acheteur le verra'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {failed ? <InlineRetry message={/brouillon/i.test(failed) ? `Article non envoyé : ${failed}` : `Article non envoyé : ${failed} Votre brouillon est gardé.`} onRetry={publish} retrying={uploading} /> : null}

        {v.media.length === 0 ? (
          <Pressable
            onPress={addMedia}
            style={({ pressed }) => [styles.emptyCover, err('media') && styles.required, pressed && { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel="Ajouter des photos ou une vidéo"
            accessibilityHint="La première photo sera la couverture"
          >
            <ImagePlus size={34} color={colors.ink} />
            <Text variant="headline">Ajouter des photos ou une vidéo</Text>
            <Text variant="caption" color={err('media') ? colors.warning : colors.textSecondary}>
              {err('media') ?? 'La première sera la couverture. Jusqu’à 10.'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.cover}>
              <PostMedia
                visual={rows}
                voice={voice ? { uri: voice.uri, durationMs: voice.durationMs, waveform: voice.waveform, language: voice.language, cues: voice.cues } : null}
                bucket="public-media"
                width={coverWidth}
                height={coverWidth}
              />
              <View style={styles.coverTag} pointerEvents="none">
                <Text variant="micro" weight="800" color={colors.white}>
                  APERÇU ACHETEUR
                </Text>
              </View>
            </View>
            <ReorderStrip
              tone="light"
              items={v.media.map((m, i) => {
                const c = voice?.cues?.find((x) => x.i === photos.indexOf(m));
                return { key: `${m.uri}-${i}`, uri: m.kind === 'image' ? m.uri : (m.posterUri ?? null), kind: m.kind, cue: c && m.kind === 'image' ? formatDuration(c.t) : null };
              })}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
              onRemove={(i) => setMedia(v.media.filter((_, j) => j !== i))}
              onAdd={addMedia}
            />
          </View>
        )}

        <View style={{ gap: 4 }}>
          <TextInput
            value={v.title}
            onChangeText={(t) => set({ title: t })}
            placeholder="Nom de l’article"
            placeholderTextColor={colors.textTertiary}
            maxLength={80}
            accessibilityLabel="Nom de l’article"
            style={[styles.name, WEB_NO_OUTLINE]}
          />
          {err('title') ? (
            <Text variant="caption" tone="danger">
              {err('title')}
            </Text>
          ) : null}
        </View>

        <View style={styles.segment} accessibilityRole="radiogroup" aria-label="Comment l’article est proposé">
          {MODES.map((m) => {
            const on = v.mode === m.key;
            return (
              <Pressable key={m.key} onPress={() => set({ mode: m.key })} style={[styles.segmentItem, on && styles.segmentOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={m.label}>
                <Text variant="callout" weight="700" color={on ? colors.white : colors.textSecondary}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 4 }}>
          <View style={styles.priceRow}>
            {isTrade || priceMode !== 'on_request' ? (
              <View style={styles.priceField}>
                <TextInput
                  value={v.price}
                  onChangeText={(t) => set({ price: formatAmountInput(t) })}
                  keyboardType="number-pad"
                  placeholder={isTrade ? 'Valeur estimée' : 'Prix'}
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={isTrade ? 'Valeur estimée (facultatif)' : priceMode === 'fixed' ? 'Prix en francs CFA' : 'Prix indicatif en francs CFA (facultatif)'}
                  style={[styles.price, WEB_NO_OUTLINE]}
                />
                <Text variant="callout" weight="700" tone="secondary">
                  F CFA
                </Text>
              </View>
            ) : (
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                Aucun prix affiché : les acheteurs vous écrivent.
              </Text>
            )}
            {!isTrade ? (
              <Pressable onPress={() => setSheet('price')} style={styles.pill} accessibilityRole="button" accessibilityLabel={`Mode de prix : ${priceInfo.a11y}. Changer`}>
                <Text variant="caption" weight="700">
                  {priceInfo.label}
                </Text>
                <ChevronDown size={14} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
          {isTrade ? (
            <Text variant="caption" tone="secondary">
              Wecci : pas de prix à indiquer. Une valeur aide à équilibrer un troc.
            </Text>
          ) : null}
          {err('price') ? (
            <Text variant="caption" tone="danger">
              {err('price')}
            </Text>
          ) : null}
        </View>

        {voice ? (
          <View style={styles.voiceRow}>
            <Mic size={18} color={colors.accentDeep} />
            <Text variant="callout" weight="700" style={{ flex: 1 }} numberOfLines={2}>
              {`Votre présentation · ${voiceSummary(voice.language, voice.durationMs)}${voice.cues && voice.cues.length > 1 ? ' · visite guidée' : ''}`}
            </Text>
            <IconButton icon={RotateCcw} label="Refaire la présentation" size={18} onPress={() => setStudio(true)} />
            <IconButton icon={Languages} label={`Langue parlée : ${voiceLanguageLabel(voice.language) ?? 'non précisée'}. Changer`} size={18} onPress={() => setSheet('language')} />
            <IconButton icon={Trash2} label="Retirer la présentation" size={18} onPress={() => set({ voice: null })} />
          </View>
        ) : (
          <Pressable
            onPress={() => setStudio(true)}
            disabled={hasVideo}
            style={({ pressed }) => [styles.present, hasVideo && { opacity: 0.5 }, pressed && { backgroundColor: colors.mintSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Présenter l’article en voix"
            accessibilityHint={hasVideo ? 'La vidéo garde son propre son' : 'Facultatif. Les acheteurs écoutent avant d’écrire'}
            accessibilityState={{ disabled: hasVideo }}
          >
            <View style={styles.presentIcon}>
              <Mic size={20} color={colors.night} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Présenter en voix</Text>
              <Text variant="caption" tone="secondary">
                {hasVideo ? 'Indisponible avec une vidéo : elle garde son propre son.' : 'Facultatif · les acheteurs écoutent avant d’écrire'}
              </Text>
            </View>
          </Pressable>
        )}

        <View style={styles.pills} accessibilityLabel="Détails de l’article">
          {pills.map((p) => {
            const empty = !p.value;
            const flagged = !!p.error || (showErrors && p.required && empty);
            return (
              <Pressable
                key={p.key}
                onPress={() => setSheet('details')}
                style={({ pressed }) => [styles.detail, flagged && styles.required, pressed && { backgroundColor: colors.surfaceSubtle }]}
                accessibilityRole="button"
                accessibilityLabel={`${p.label} : ${p.value ?? (p.required ? 'requis' : 'facultatif')}. Modifier`}
              >
                <Text variant="caption" weight="700" tone="secondary">
                  {p.label}
                </Text>
                <Text variant="callout" weight="600" numberOfLines={1} color={empty ? (flagged ? colors.warning : colors.textTertiary) : colors.ink}>
                  {p.value ?? (p.required ? 'requis' : 'ajouter')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Toggle value={v.alsoPost} onChange={(b) => set({ alsoPost: b })} label="Partager aussi dans mon fil" description={voice ? 'Avec votre présentation en voix.' : undefined} />
        <Text variant="caption" tone="secondary">
          Le paiement (espèces, Wave, Orange Money…) se convient directement entre vous. Jëfëli ne détient aucun fonds.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button label={isTrade ? 'Proposer en troc' : 'Mettre en vente'} variant="cta" size="lg" pill fullWidth onPress={publish} style={{ height: 56, width: '100%', maxWidth: 640, alignSelf: 'center' }} />
      </View>

      <VoiceStudio
        visible={studio}
        title={v.title.trim() ? `Présenter ${v.title.trim()}` : 'Présenter l’article'}
        photos={photos.length > 1 ? photos.map((p) => p.uri) : undefined}
        language={voice?.language ?? pendingLanguage}
        onLanguage={setLanguage}
        onDone={useVoice}
        onClose={() => setStudio(false)}
        avatar={{ path: profile?.avatar_path, name: profile?.display_name ?? 'Moi' }}
      />

      <Sheet visible={sheet === 'price'} onClose={() => setSheet(null)} title="Comment afficher le prix ?">
        {PRICES.map((p) => {
          const on = priceMode === p.key;
          return (
            <Pressable key={p.key} onPress={() => (set({ priceMode: p.key }), setSheet(null))} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={p.a11y}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{p.label}</Text>
                <Text variant="caption" tone="secondary">
                  {p.hint}
                </Text>
              </View>
              {on ? <Check size={18} color={colors.accentDeep} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={sheet === 'language'} onClose={() => setSheet(null)} title="Langue parlée">
        {VOICE_LANGUAGES.map((l) => {
          const on = (voice?.language ?? null) === l.key;
          return (
            <Pressable key={l.key} onPress={() => (setLanguage(on ? null : l.key), setSheet(null))} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={l.label}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {l.label}
              </Text>
              {on ? <Check size={18} color={colors.accentDeep} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={sheet === 'details'} onClose={() => setSheet(null)} title="Détails" scroll>
        <View style={{ gap: spacing.xl, paddingBottom: spacing.md }}>
          <View style={styles.group}>
            <Text variant="callout" weight="700">
              Catégorie <Text variant="caption" color={v.category ? colors.textSecondary : colors.warning}>· requis</Text>
            </Text>
            <View style={styles.wrap}>
              {cats.map((c) => (
                <Chip key={c.slug} label={c.name} selected={v.category === c.slug} onPress={() => set({ category: c.slug })} style={v.category === c.slug ? styles.chipOn : styles.idle} />
              ))}
            </View>
          </View>
          <View style={styles.group}>
            <Text variant="callout" weight="700">
              État
            </Text>
            <View style={styles.wrap} accessibilityLabel="État de l’article">
              {CONDITION_OPTIONS.map((c) => (
                <Chip key={c} label={CONDITION_LABELS[c]} selected={v.condition === c} onPress={() => set({ condition: c })} style={v.condition === c ? styles.chipOn : styles.idle} />
              ))}
            </View>
          </View>
          <LocationPicker city={v.city} neighborhood={v.neighborhood} onChange={(n) => set({ city: n.city, neighborhood: n.neighborhood })} compact />
          <View style={styles.group}>
            <Text variant="callout" weight="700">
              Remise
            </Text>
            <View style={styles.wrap}>
              {Object.entries(DELIVERY_LABELS).map(([k, label]) => {
                const on = v.delivery.includes(k);
                return <Chip key={k} label={label} selected={on} onPress={() => set({ delivery: on ? v.delivery.filter((x) => x !== k) : [...v.delivery, k] })} style={on ? styles.chipOn : styles.idle} />;
              })}
            </View>
            <Field value={v.deliveryNotes} onChangeText={(t) => set({ deliveryNotes: t })} placeholder="Précision (facultatif) : livraison Dakar 1 000 F, retrait à Sacré-Cœur…" maxLength={300} accessibilityLabel="Précisions sur la remise (facultatif)" />
          </View>
          <Field label="Description (facultatif)" value={v.description} onChangeText={(t) => set({ description: t })} multiline maxLength={2000} counter placeholder="Taille, état, détails utiles…" />
          <View style={styles.qtyRow}>
            <Text variant="callout" weight="700" style={{ flex: 1 }}>
              Quantité
            </Text>
            <Pressable onPress={() => set({ quantity: Math.max(1, v.quantity - 1) })} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel="Diminuer la quantité">
              <Minus size={18} color={colors.ink} />
            </Pressable>
            <Text variant="headline" style={{ minWidth: 32, textAlign: 'center' }} accessibilityLabel={`Quantité : ${v.quantity}`}>
              {v.quantity}
            </Text>
            <Pressable onPress={() => set({ quantity: Math.min(9999, v.quantity + 1) })} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel="Augmenter la quantité">
              <Plus size={18} color={colors.ink} />
            </Pressable>
          </View>
          <Button label="Terminé" variant="primary" pill onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      <UploadOverlay visible={uploading} progress={progress} label="Mise en vente…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  body: { padding: spacing.lg, gap: 20, paddingBottom: spacing.xxl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  emptyCover: { aspectRatio: 1, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  required: { borderColor: colors.gold, borderStyle: 'solid', borderWidth: 2 },
  cover: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.night, alignSelf: 'center' },
  coverTag: { position: 'absolute', bottom: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.overlay },
  name: { fontFamily: fonts.serifSemibold, fontSize: 28, lineHeight: 34, color: colors.ink, paddingVertical: 4 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSubtle, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentOn: { backgroundColor: colors.night },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  priceField: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, borderBottomWidth: 2, borderBottomColor: colors.border },
  price: { flex: 1, minWidth: 0, fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 36, color: colors.ink, paddingVertical: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  present: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.mint, backgroundColor: colors.surface },
  presentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.mint, backgroundColor: colors.mintSoft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: { minWidth: 96, maxWidth: '48%', flexGrow: 1, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 40 },
  chipOn: { backgroundColor: colors.night, height: 40 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.sm, borderRadius: 12 },
  choiceOn: { backgroundColor: colors.mintSoft },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.glassLight, borderTopWidth: 1, borderTopColor: colors.border },
});
