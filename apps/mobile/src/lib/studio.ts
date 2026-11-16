/**
 * Studio publication (P2): one pipeline for every mode. The files are uploaded once (the existing
 * upload, retry, quota and cancel), then each ticked destination is created through the data
 * paths that already exist:
 *   Boutique → create_listing     Fil / Reel → create_post (+ set_post_surfaces)
 *   Statut   → create_story (one photo, video or voice) or share_to_status (a narrated or
 *              multi-photo creation points at its publication: nothing is sent twice)
 * A status and a public destination need the same file in two buckets: it is copied server-side,
 * never uploaded twice.
 */
import { type Audience, type Destination, textIntent, type ListingMode, type PriceMode, type TextStarter, type ItemCondition } from '@jefeli/shared';

import { createPost, setPostSurfaces } from './api/posts';
import { createListing } from './api/products';
import { createStory, shareToStatus } from './api/stories';
import { supabase } from './supabase';
import { uploadMediaBatch, type LocalMedia, type UploadedMedia } from './upload';
import { uploadVoice, type UploadedVoice, type VoiceAttachment } from './voice';

export interface StudioItem {
  title: string;
  description: string;
  mode: ListingMode;
  priceMode: PriceMode;
  priceXof: number | null;
  category: string;
  condition: ItemCondition;
  city: string;
  neighborhood: string;
}

export interface StudioPublishArgs {
  userId: string;
  media: LocalMedia[];
  voice: VoiceAttachment | null;
  caption: string;
  destinations: Destination[];
  item: StudioItem | null;
  starter: TextStarter | null;
  statusAudience: Audience;
  /** Who sees the Fil publication (a Reel and an article are always public). */
  feedAudience?: Audience;
  /** An article that already exists (« Présenter cet article »): tagged on the publication and the status. */
  linkProductId?: string | null;
  onProgress?: (f: number) => void;
  signal?: AbortSignal;
}

export interface StudioResult {
  listingId: string | null;
  postId: string | null;
  storyIds: string[];
  /** Destinations that could not be created (the others went out). */
  failed: { destination: Destination; error: unknown }[];
}

type Bucket = 'public-media' | 'private-media';

/** Server-side copy of an uploaded object into the other bucket (same path, same owner). */
async function copyToBucket(from: Bucket, to: Bucket, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(from).copy(path, path, { destinationBucket: to });
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
}

export async function publishStudio(a: StudioPublishArgs): Promise<StudioResult> {
  const sel = new Set(a.destinations);
  const result: StudioResult = { listingId: null, postId: null, storyIds: [], failed: [] };
  const visualCount = a.media.length;
  const photos = a.media.filter((m) => m.kind === 'image').length;
  const narratedOrMulti = (visualCount > 0 && !!a.voice) || photos > 1;
  const statusViaFeed = sel.has('status') && narratedOrMulti;
  const directStatus = sel.has('status') && !statusViaFeed;
  const feedAudience: Audience = a.feedAudience ?? 'public';
  const feedPublic = feedAudience === 'public';
  const needsPublic = (sel.has('feed') && feedPublic) || sel.has('reel') || sel.has('boutique');
  const needsPrivate = directStatus || ((sel.has('feed') || statusViaFeed) && !feedPublic);
  const first: Bucket = needsPublic ? 'public-media' : 'private-media';
  const total = visualCount + (a.voice ? 1 : 0) || 1;
  const share = a.voice ? visualCount / total : 1;

  // 1. Upload once.
  const uploaded: UploadedMedia[] = visualCount
    ? await uploadMediaBatch(a.userId, a.media.map((m) => ({ ...m, file: m.file instanceof Blob ? m.file : null })), {
        bucket: first,
        folder: 'studio',
        onProgress: (f) => a.onProgress?.(f * share),
        signal: a.signal,
      })
    : [];
  let voiceUp: UploadedVoice | null = null;
  if (a.voice) {
    voiceUp = await uploadVoice(a.userId, a.voice, { bucket: first, folder: 'studio', onProgress: (f) => a.onProgress?.(share + f * (1 - share)), signal: a.signal });
  }
  if (needsPublic && needsPrivate) {
    for (const u of uploaded) {
      await copyToBucket('public-media', 'private-media', u.path);
      await copyToBucket('public-media', 'private-media', u.poster_path);
    }
    if (voiceUp) await copyToBucket('public-media', 'private-media', voiceUp.path);
  }
  const attach = (list: UploadedMedia[]) => (voiceUp ? [...list, voiceUp] : list);

  // 2. Article.
  if (sel.has('boutique') && a.item) {
    try {
      result.listingId = await createListing(
        {
          title: a.item.title.trim(),
          description: a.item.description.trim(),
          price_xof: a.item.mode === 'give' ? 0 : a.item.priceXof,
          price_mode: a.item.mode === 'trade' || a.item.mode === 'give' ? 'fixed' : a.item.priceMode,
          category_slug: a.item.category,
          condition: a.item.condition,
          listing_mode: a.item.mode,
          quantity: 1,
          city: a.item.city.trim(),
          neighborhood: a.item.neighborhood.trim(),
          delivery_options: ['pickup'],
          delivery_notes: '',
        },
        uploaded,
        voiceUp,
      );
    } catch (e) {
      result.failed.push({ destination: 'boutique', error: e });
    }
  }

  // 3. Publication (Fil and/or Reel).
  if (sel.has('feed') || sel.has('reel') || statusViaFeed) {
    try {
      result.postId = await createPost({
        body: a.caption.trim(),
        visibility: feedAudience,
        media: attach(uploaded),
        productIds: result.listingId ?? a.linkProductId ? [(result.listingId ?? a.linkProductId) as string] : [],
        intent: visualCount === 0 && !a.voice ? textIntent(a.starter) : 'share',
      });
      // Reel and/or Fil flags; a status shared through the publication still needs Fil to show it.
      const inFeed = sel.has('feed');
      const inReels = sel.has('reel');
      if (inReels || !inFeed) await setPostSurfaces(result.postId, inFeed || !inReels, inReels);
    } catch (e) {
      result.failed.push({ destination: sel.has('feed') ? 'feed' : 'reel', error: e });
    }
  }

  // 4. Status.
  if (sel.has('status')) {
    try {
      if (statusViaFeed) {
        if (!result.postId) throw new Error('post_required');
        result.storyIds.push(await shareToStatus({ postId: result.postId, caption: a.caption.trim().slice(0, 200), audience: a.statusAudience }));
      } else if (a.voice && uploaded.length === 0 && voiceUp) {
        result.storyIds.push(
          await createStory({ media_kind: 'audio', path: voiceUp.path, width: null, height: null, duration_ms: voiceUp.duration_ms, caption: a.caption.trim().slice(0, 200), audience: a.statusAudience, product_id: result.listingId ?? a.linkProductId ?? null }),
        );
      } else if (uploaded[0]) {
        const u = uploaded[0];
        result.storyIds.push(
          await createStory({ media_kind: u.kind, path: u.path, poster_path: u.poster_path, width: u.width, height: u.height, duration_ms: u.duration_ms, caption: a.caption.trim().slice(0, 200), audience: a.statusAudience, product_id: result.listingId ?? a.linkProductId ?? null }),
        );
      }
    } catch (e) {
      result.failed.push({ destination: 'status', error: e });
    }
  }
  return result;
}

/** A recorded or captured file as upload-ready media (web: the Blob is kept for upload). */
export async function localFromUri(uri: string, kind: 'image' | 'video', size: { width: number; height: number }, durationMs?: number | null, mimeType?: string): Promise<LocalMedia> {
  let file: Blob | null = null;
  try {
    if (uri.startsWith('data:') || uri.startsWith('blob:')) file = await (await fetch(uri)).blob();
  } catch {
    file = null;
  }
  return {
    uri,
    kind,
    width: size.width || 1080,
    height: size.height || 1080,
    durationMs: durationMs ?? null,
    mimeType: mimeType ?? file?.type ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    fileSize: file?.size ?? null,
    file,
  };
}

