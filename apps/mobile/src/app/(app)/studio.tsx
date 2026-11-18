/**
 * Studio (P2): the one « + ». The full-screen camera opens directly (capture), then a composer
 * (preview, caption, the « Vendre ou troquer » switch, destinations). It replaces the old card
 * menu and the separate Publication, Statut and Article editors; the data paths are the same
 * (create_post, create_listing, create_story, share_to_status — see lib/studio.ts).
 *
 * The draft is saved at every step (existing useDraft): closing the Studio, a crash or a browser
 * refresh brings the creation back, with « Recommencer » to start over.
 */
import {
  AUDIENCE_LABELS,
  canSell as canSellRule,
  defaultSelection,
  formatAmountInput,
  formatDuration,
  itemTitleFromCaption,
  looksLikeWhatsappPaste,
  MAX_PHOTOS,
  TEXT_STARTERS,
  normalizeSelection,
  parseWhatsappListing,
  parseXOF,
  sellDefault,
  studioBlocker,
  whatsappCaption,
  toFrenchError,
  type Audience,
  type Destination,
  type StudioError,
  type StudioMode,
  type TextStarter,
} from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { VoiceStudio } from '@/components/audio/VoiceStudio';
import { UploadOverlay } from '@/components/Composer';
import { StudioCapture } from '@/components/studio/StudioCapture';
import { StudioComposer, type ItemDraft } from '@/components/studio/StudioComposer';
import { colors, useToast } from '@/design';
import { getSettings } from '@/lib/api/profiles';
import { countMyListings, fetchCategories, fetchProduct } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { keepMediaForDraft, restoreDraftMedia } from '@/lib/draftFiles';
import { discardDraft, useDraft } from '@/lib/drafts';
import { useLayout } from '@/lib/layout';
import { goBack } from '@/lib/nav';
import { publishStudio } from '@/lib/studio';
import { pickMedia, uploadErrorMessage, UploadError, type LocalMedia } from '@/lib/upload';
import { keepForDraft, restoreVoice, type RecordedClip, type VoiceAttachment } from '@/lib/voice';

const KEY = 'studio';
const LAST_LANGUAGE = 'voice:lastLanguage';
type Params = { mode?: string; intent?: string; product?: string; dest?: string; sell?: string };

const BLOCKERS: Record<StudioError, string> = {
  no_content: 'Ajoutez une photo, une vidéo, une voix ou un texte.',
  no_destination: 'Choisissez au moins une destination.',
  text_only_item: 'Un texte ne peut pas être un article : ajoutez une photo ou une vidéo.',
  item_title: 'Donnez un nom à l’article (3 caractères minimum, au début de la légende).',
  item_price: 'Indiquez un prix, ou choisissez « À discuter » ou « Sur demande ».',
  item_category: 'Choisissez une catégorie.',
  text_needed: 'Écrivez votre texte.',
};

export default function Studio() {
  const params = useLocalSearchParams<Params>();
  const { userId, profile } = useAuth();
  const { desktop } = useLayout();
  const qc = useQueryClient();
  const toast = useToast();
  const draft = useDraft(KEY, {
    // P4: the composer is the first screen; « capture » is the camera, opened over it from the toolbar.
    step: 'compose' as 'capture' | 'compose',
    mode: 'photo' as StudioMode,
    photos: [] as LocalMedia[],
    video: null as LocalMedia | null,
    voice: null as VoiceAttachment | null,
    caption: '',
    starter: null as TextStarter | null,
    sell: null as boolean | null,
    item: { mode: 'sale', priceMode: 'fixed', price: '', category: '', condition: 'new', neighborhood: profile?.neighborhood ?? '' } as ItemDraft,
    destinations: null as Destination[] | null,
    feedAudience: 'public' as Audience,
    linkProductId: null as string | null,
  });
  const v = draft.value;
  const set = (patch: Partial<typeof v>) => draft.setValue((cur) => ({ ...cur, ...patch }));
  const [studio, setStudio] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const restoring = useRef(false);
  const applied = useRef(false);
  // P3: a pasted WhatsApp announcement fills the article; one line says so, with « Annuler ».
  const [pasted, setPasted] = useState<null | { text: string; before: { caption: string; item: ItemDraft; sell: boolean | null } }>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const settings = useQuery({ queryKey: ['settings', userId], queryFn: () => getSettings(userId ?? ''), enabled: !!userId });
  const linked = useQuery({ queryKey: ['product', v.linkProductId], queryFn: () => fetchProduct(v.linkProductId ?? ''), enabled: !!v.linkProductId });

  // A restored draft: rebuild its files and voice (web) or say what must be chosen again.
  useEffect(() => {
    if (!draft.restored || restoring.current) return;
    restoring.current = true;
    void (async () => {
      const [photos, video, voice] = await Promise.all([
        restoreDraftMedia(draft.value.photos ?? []),
        draft.value.video ? restoreDraftMedia([draft.value.video]) : Promise.resolve({ items: [], lost: 0 }),
        restoreVoice(draft.value.voice),
      ]);
      draft.setValue((d) => ({ ...d, photos: photos.items, video: video.items[0] ?? null, voice }));
      if (photos.lost + video.lost > 0 || (draft.value.voice && !voice)) toast('Une partie du brouillon n’a pas pu être récupérée : ajoutez-la à nouveau.', 'info');
    })();
  }, [draft.restored, draft, toast]);

  // Entry points: `?mode=voice|text|photo|video`, `?intent=seek` (« Je cherche »), `?product=` (present an article).
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const m = params.mode as StudioMode | undefined;
    // P4: photo / vidéo / voix open the camera (or the voice recorder) over the composer; the text is the composer itself.
    if (m && ['photo', 'video', 'voice'].includes(m)) draft.setValue((d) => ({ ...d, mode: m, step: 'capture' }));
    else if (params.intent === 'seek' || params.intent === 'opinion') {
      const st = TEXT_STARTERS.find((x) => x.key === (params.intent === 'seek' ? 'seek' : 'recommend'));
      draft.setValue((d) => ({ ...d, mode: 'text', starter: st?.key ?? null, caption: d.caption || (st?.text ?? ''), step: 'compose' }));
    }
    if (params.sell === '1') draft.setValue((d) => ({ ...d, sell: true }));
    if (params.dest === 'status') draft.setValue((d) => ({ ...d, destinations: ['status'] }));
    if (params.product) draft.setValue((d) => ({ ...d, linkProductId: params.product ?? null, sell: false }));
    void AsyncStorage.getItem(LAST_LANGUAGE).then((l) => l && setLanguage((cur) => cur ?? l));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCaption(caption: string) {
    if (canSellFromMedia && looksLikeWhatsappPaste(v.caption, caption)) {
      const p = parseWhatsappListing(caption);
      const mode = p.mode ?? v.item.mode;
      const price = mode === 'give' || mode === 'trade' ? '' : p.priceXof ? formatAmountInput(String(p.priceXof)) : v.item.price;
      setPasted({
        text: `${p.summary}${p.extraBlocks ? ` ${p.extraBlocks} autre${p.extraBlocks > 1 ? 's' : ''} article${p.extraBlocks > 1 ? 's' : ''} dans votre texte : collez-les un par un.` : ''}${p.title ? '' : ' Ajoutez le nom de l’article.'}`.trim(),
        before: { caption: v.caption, item: v.item, sell: v.sell },
      });
      set({ caption: whatsappCaption(p) || caption, sell: true, item: { ...v.item, mode, price, priceMode: mode === 'sale' || mode === 'sale_or_trade' ? 'fixed' : v.item.priceMode } });
      return;
    }
    if (pasted) setPasted(null);
    set({ caption });
  }
  function undoPaste() {
    if (!pasted) return;
    set({ caption: pasted.before.caption, item: pasted.before.item, sell: pasted.before.sell });
    setPasted(null);
  }

  // P4: photos and one video go together (photos first, the video as the last slide).
  const media: LocalMedia[] = v.video ? [...v.photos, v.video] : v.photos;
  const baseInput = {
    photos: v.photos.length,
    hasVideo: !!v.video,
    hasVoice: !!v.voice,
    hasText: v.caption.trim().length > 0,
    hasBoutique: !!profile?.is_merchant,
    feedAudience: v.feedAudience,
  };
  const canSell = canSellRule(baseInput) && !v.linkProductId;
  const canSellFromMedia = canSell;
  const sell = canSell && (v.sell ?? sellDefault({ ...baseInput, sell: false }));
  const input = { ...baseInput, sell };
  const selected = useMemo(
    () => normalizeSelection(input, v.destinations ?? defaultSelection(input)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v.destinations, input.photos, input.hasVideo, input.hasVoice, input.hasText, input.sell],
  );
  const hasContent = media.length > 0 || !!v.voice || v.caption.trim().length > 0;
  const statusAudience = (settings.data?.default_status_audience as Audience | undefined) ?? 'followers';

  function setMedia(photos: LocalMedia[], video: LocalMedia | null) {
    set({ photos, video });
    void keepMediaForDraft(KEY, video ? [...photos, video] : photos).then((kept) =>
      draft.setValue((d) => ({
        ...d,
        photos: d.photos.map((m) => kept.find((k) => k.uri === m.uri) ?? m),
        video: d.video ? (kept.find((k) => k.uri === d.video?.uri) ?? d.video) : null,
      })),
    );
  }

  async function useVoice(clip: RecordedClip) {
    const kept = await keepForDraft(KEY, clip);
    set({ voice: { ...kept, language } });
    setStudio(false);
  }

  function toggle(d: Destination) {
    const next = selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d];
    set({ destinations: next });
  }

  async function restart() {
    await discardDraft('studio').catch(() => {});
    await draft.clear();
    restoring.current = false;
  }

  async function publish() {
    if (!userId) return;
    const item = sell ? { title: itemTitleFromCaption(v.caption), mode: v.item.mode, price: parseXOF(v.item.price), priceMode: v.item.priceMode, category: v.item.category } : null;
    const blocker = studioBlocker(input, selected, item);
    if (blocker) {
      setError(BLOCKERS[blocker]);
      return;
    }
    setError(null);
    abort.current = new AbortController();
    setUploading(true);
    setProgress(0);
    try {
      const price = parseXOF(v.item.price);
      const result = await publishStudio({
        userId,
        media,
        voice: v.voice,
        caption: v.caption,
        destinations: selected,
        item: sell
          ? {
              title: itemTitleFromCaption(v.caption),
              description: v.caption,
              mode: v.item.mode,
              priceMode: v.item.mode === 'trade' || v.item.mode === 'give' ? 'fixed' : v.item.priceMode,
              priceXof: price && price > 0 ? price : null,
              category: v.item.category,
              condition: v.item.condition,
              city: profile?.city ?? 'Dakar',
              neighborhood: v.item.neighborhood,
            }
          : null,
        starter: v.starter,
        statusAudience,
        feedAudience: v.feedAudience,
        linkProductId: v.linkProductId,
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      if (result.failed.length >= selected.length) throw result.failed[0]?.error ?? new Error('publish');
      await draft.clear();
      void discardDraft('studio').catch(() => {});
      for (const key of ['feed', 'story-rail', 'explore', 'me', 'reels']) void qc.invalidateQueries({ queryKey: [key] });
      void qc.invalidateQueries({ queryKey: ['active-stories', userId] });
      void qc.invalidateQueries({ queryKey: ['seller-products', userId] });
      void qc.invalidateQueries({ queryKey: ['my-active-products', userId] });
      void qc.invalidateQueries({ queryKey: ['user-posts'] });
      if (result.failed.length > 0) {
        const names = result.failed.map((f) => ({ feed: 'Fil', status: 'Statut', reel: 'Reel', boutique: 'Boutique' })[f.destination]).join(', ');
        toast(`Publié, sauf : ${names}. Vous pourrez le refaire depuis le contenu publié.`, 'error');
      } else {
        toast(result.listingId ? 'Article mis en vente' : sel(selected, 'status') ? 'Statut publié pour 24 h' : 'Publié', 'success');
      }
      if (result.listingId) {
        const first = await countMyListings(userId).then((n) => n === 1).catch(() => false);
        router.replace(first ? `/p/${result.listingId}?first=1` : `/p/${result.listingId}`);
      } else if (result.postId && selected.includes('feed')) router.replace(`/post/${result.postId}`);
      else if (result.postId && selected.includes('reel')) router.replace(`/reels?start=${result.postId}`);
      else goBack();
    } catch (e) {
      setError(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e));
    } finally {
      setUploading(false);
    }
  }

  async function addFromGallery() {
    try {
      const picked = await pickMedia({ allowVideo: true, multiple: true, limit: MAX_PHOTOS });
      if (!picked?.length) return;
      const video = picked.find((m) => m.kind === 'video');
      const images = picked.filter((m) => m.kind === 'image');
      setMedia(images.length ? [...v.photos, ...images].slice(0, MAX_PHOTOS) : v.photos, video ?? v.video);
      if (video && v.voice) {
        set({ voice: null });
        toast('Votre voix a été retirée : une vidéo garde son propre son.', 'info');
      }
      if (picked.filter((m) => m.kind === 'video').length > 1) toast('Une seule vidéo par publication : la première est gardée.', 'info');
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }
  function openVoice() {
    if (v.video) toast('Une vidéo garde son propre son : retirez la vidéo pour ajouter votre voix.', 'info');
    else setStudio(true);
  }
  function toggleSell(on: boolean) {
    if (on && !canSell) {
      // An article needs a picture: open the gallery, the switch turns on as soon as one is added.
      toast('Ajoutez d’abord une photo ou une vidéo de l’article.', 'info');
      set({ sell: true });
      void addFromGallery();
      return;
    }
    set({ sell: on });
  }
  function removeMedia(i: number) {
    if (v.video && i === v.photos.length) setMedia(v.photos, null);
    else setMedia(v.photos.filter((_, j) => j !== i), v.video);
  }

  const column = desktop ? ({ width: '100%', maxWidth: 520, alignSelf: 'center' } as const) : null;
  const voiceLabel = v.voice ? `Voix · ${formatDuration(v.voice.durationMs)}` : null;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.mediaBackdrop }, column]}>
      <StudioComposer
        input={input}
        media={media}
        voice={v.voice}
        caption={v.caption}
        onCaption={onCaption}
        pasteNote={pasted ? { text: pasted.text, onUndo: undoPaste } : null}
        sell={sell}
        canSell={canSell}
        onSell={toggleSell}
        item={v.item}
        onItem={(patch) => set({ item: { ...v.item, ...patch } })}
        categories={categories.data ?? []}
        selected={selected}
        onToggle={toggle}
        feedAudience={v.feedAudience}
        onFeedAudience={(feedAudience) => set({ feedAudience })}
        statusAudienceLabel={`Visible par : ${AUDIENCE_LABELS[statusAudience].toLowerCase()}`}
        error={error}
        restored={draft.restored && hasContent}
        onRestart={restart}
        onPublish={publish}
        publishing={uploading}
        linkedTitle={linked.data?.title ?? null}
        onUnlink={() => set({ linkProductId: null })}
        displayName={profile?.display_name ?? 'Moi'}
        avatarPath={profile?.avatar_path}
        starter={v.starter}
        onStarter={(key) => {
          const st = TEXT_STARTERS.find((x) => x.key === key);
          set({ starter: key, caption: v.caption || (st?.text ?? '') });
        }}
        onClose={() => goBack()}
        onGallery={() => void addFromGallery()}
        onCamera={() => set({ step: 'capture', mode: v.mode === 'voice' || v.mode === 'text' ? 'photo' : v.mode })}
        onVoice={openVoice}
        onRemoveMedia={removeMedia}
        onRemoveVoice={() => set({ voice: null })}
        autoFocus={v.step === 'compose' && !params.mode}
      />

      {v.step === 'capture' ? (
        <View style={StyleSheet.absoluteFill}>
          <StudioCapture
            mode={v.mode}
            onMode={(mode) => set({ mode })}
            photos={v.photos}
            video={v.video}
            voiceLabel={voiceLabel}
            text={v.caption}
            starter={v.starter}
            onText={(caption, starter) => set({ caption, starter })}
            onPhotos={(photos) => setMedia(photos, v.video)}
            onMedia={(photos, video) => {
              setMedia(photos, video);
              if (video && v.voice) {
                set({ voice: null });
                toast('Votre voix a été retirée : une vidéo garde son propre son.', 'info');
              }
            }}
            onVideo={(video) => {
              setMedia(v.photos, video);
              // A video keeps its own sound (the database refuses a voice over a video): the voice is dropped.
              if (video && v.voice) {
                set({ voice: null });
                toast('Votre voix a été retirée : une vidéo garde son propre son.', 'info');
              }
            }}
            onOpenVoice={openVoice}
            onNext={() => set({ step: 'compose' })}
            onClose={() => set({ step: 'compose' })}
          />
        </View>
      ) : null}

      <VoiceStudio
        visible={studio}
        title={media.length > 1 ? 'Expliquez vos photos' : 'Votre message vocal'}
        photos={!v.video && v.photos.length > 1 ? v.photos.map((m) => m.uri) : undefined}
        language={v.voice?.language ?? language}
        onLanguage={(l) => {
          setLanguage(l);
          if (l) void AsyncStorage.setItem(LAST_LANGUAGE, l).catch(() => {});
        }}
        onDone={useVoice}
        onClose={() => setStudio(false)}
        avatar={{ path: profile?.avatar_path, name: profile?.display_name ?? 'Moi' }}
      />
      <UploadOverlay visible={uploading} progress={progress} label="Envoi en cours…" onCancel={() => abort.current?.abort()} />
    </View>
  );
}

const sel = (list: Destination[], d: Destination) => list.includes(d);
