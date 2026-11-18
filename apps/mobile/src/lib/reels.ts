/**
 * « Le garder en Reel ? » — turns a video status into a permanent Reel (P2).
 * The file is copied server-side from the private status bucket to the public one (same path, same
 * owner), then published through create_post and shown in Reels only (not in Fil: the owner
 * chose a Reel, not a new post for their followers' feed).
 */
import { createPost, setPostSurfaces } from './api/posts';
import { supabase } from './supabase';
import type { StoryRow } from './types';

export async function keepStoryAsReel(story: Pick<StoryRow, 'storage_path' | 'poster_path' | 'width' | 'height' | 'duration_ms' | 'caption' | 'product_id' | 'media_kind'>): Promise<string> {
  const file = story.storage_path;
  if (story.media_kind !== 'video' || !file) throw new Error('not_a_reel');
  for (const path of [file, story.poster_path]) {
    if (!path) continue;
    const { error } = await supabase.storage.from('private-media').copy(path, path, { destinationBucket: 'public-media' });
    if (error && !/exists|duplicate/i.test(error.message)) throw error;
  }
  const id = await createPost({
    body: story.caption ?? '',
    visibility: 'public',
    media: [
      {
        kind: 'video',
        path: file,
        poster_path: story.poster_path ?? undefined,
        width: story.width ?? 720,
        height: story.height ?? 1280,
        duration_ms: story.duration_ms,
      },
    ],
    productIds: story.product_id ? [story.product_id] : [],
  });
  await setPostSurfaces(id, false, true);
  return id;
}
