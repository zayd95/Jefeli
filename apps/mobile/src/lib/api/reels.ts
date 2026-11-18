import { supabase, unwrap } from '../supabase';
import type { PostCardData } from '../types';
import { fetchPostsByIds } from './posts';

export const REELS_PAGE = 8;

/**
 * One page of the Reels feed. The ranking is the database's (`get_reels`: freshness + followed +
 * nearby + has an article); `start` pins one Reel first (opened from a video or an end card).
 */
export async function fetchReels(userId: string | null, page: { offset: number; start?: string | null }): Promise<{ items: PostCardData[]; next: number | null }> {
  const ranked = unwrap(
    await supabase.rpc('get_reels', { p_limit: REELS_PAGE, p_offset: page.offset, p_start: page.offset === 0 ? (page.start ?? undefined) : undefined }),
  ) as { post_id: string; reason: string; score: number }[];
  const posts = await fetchPostsByIds(
    userId,
    ranked.map((r) => r.post_id),
  );
  const reasons = new Map(ranked.map((r) => [r.post_id, r.reason]));
  const items = posts.filter((p) => p.media.some((m) => m.kind === 'video')).map((p) => ({ ...p, reason: reasons.get(p.id) }));
  return { items, next: ranked.length < REELS_PAGE ? null : page.offset + ranked.length };
}
