/**
 * Keeps every cached copy of a post in sync (home feed pages, post screen, profile grid, saved
 * posts), so a vote or a new comment shows the same state everywhere without refetching and
 * re-ranking the feed.
 */
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { PostCardData } from './types';

type FeedPage = { items: PostCardData[]; next: unknown };

export function patchPost(qc: QueryClient, postId: string, patch: (p: PostCardData) => Partial<PostCardData>) {
  const apply = (p: PostCardData): PostCardData => (p.id === postId ? { ...p, ...patch(p) } : p);
  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (d) =>
    d ? { ...d, pages: d.pages.map((pg) => ({ ...pg, items: pg.items.map(apply) })) } : d,
  );
  qc.setQueriesData<InfiniteData<PostCardData[]>>({ queryKey: ['user-posts'] }, (d) =>
    d ? { ...d, pages: d.pages.map((pg) => pg.map(apply)) } : d,
  );
  qc.setQueriesData<PostCardData[]>({ queryKey: ['saved-posts'] }, (d) => d?.map(apply));
  qc.setQueryData<PostCardData | null>(['post', postId], (d) => (d ? apply(d) : d));
}

/** Read the freshest cached copy (the card's props can lag one render behind a fast double tap). */
export function cachedPost(qc: QueryClient, postId: string): PostCardData | undefined {
  const direct = qc.getQueryData<PostCardData | null>(['post', postId]);
  if (direct) return direct;
  for (const [, d] of qc.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] })) {
    const hit = d?.pages.flatMap((pg) => pg.items).find((p) => p.id === postId);
    if (hit) return hit;
  }
  return undefined;
}
