import type { UploadedMedia } from '../upload';
import { supabase, unwrap } from '../supabase';
import type { CommentRow, PostCardData } from '../types';
import { PROFILE_LITE } from './profiles';

export const POST_SELECT = `*,
  author:profiles!posts_author_id_fkey(${PROFILE_LITE}),
  media:post_media(id, kind, bucket, storage_path, poster_path, width, height, duration_ms, position),
  tagged:post_products(product:products(id, title, price_xof, status, listing_mode, condition, media:product_media(storage_path, kind, poster_path, position)))`;

export const FEED_PAGE = 12;

function sortMedia(p: PostCardData): PostCardData {
  return { ...p, media: [...(p.media ?? [])].sort((a, b) => a.position - b.position) };
}

async function decorate(userId: string | null, posts: PostCardData[]): Promise<PostCardData[]> {
  if (!userId || posts.length === 0) return posts.map(sortMedia);
  const ids = posts.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.from('post_saves').select('post_id').eq('user_id', userId).in('post_id', ids),
  ]);
  const liked = new Set((likes.data ?? []).map((r) => r.post_id));
  const saved = new Set((saves.data ?? []).map((r) => r.post_id));
  return posts.map((p) => ({ ...sortMedia(p), liked: liked.has(p.id), saved: saved.has(p.id) }));
}

export async function fetchPostsByIds(userId: string | null, ids: string[]): Promise<PostCardData[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(await supabase.from('posts').select(POST_SELECT).in('id', ids)) as unknown as PostCardData[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return decorate(
    userId,
    ids.map((id) => byId.get(id)).filter((p): p is PostCardData => !!p),
  );
}

/** Home feed page. `for_you` uses offset pagination (ranked); others use time cursors. */
export async function fetchFeed(
  userId: string | null,
  tab: 'for_you' | 'following' | 'nearby',
  page: { offset: number; before: string | null },
): Promise<{ items: PostCardData[]; next: { offset: number; before: string | null } | null }> {
  const ranked = unwrap(
    await supabase.rpc('get_feed', {
      p_tab: tab,
      p_limit: FEED_PAGE,
      p_offset: tab === 'for_you' ? page.offset : 0,
      p_before: tab === 'for_you' ? undefined : (page.before ?? undefined),
    }),
  ) as { post_id: string; reason: string; created_at: string }[];
  const posts = await fetchPostsByIds(
    userId,
    ranked.map((r) => r.post_id),
  );
  const reasons = new Map(ranked.map((r) => [r.post_id, r.reason]));
  const items = posts.map((p) => ({ ...p, reason: reasons.get(p.id) }));
  const last = ranked[ranked.length - 1];
  const next =
    ranked.length < FEED_PAGE
      ? null
      : tab === 'for_you'
        ? { offset: page.offset + ranked.length, before: null }
        : { offset: 0, before: last?.created_at ?? null };
  return { items, next };
}

export async function fetchPost(userId: string | null, id: string): Promise<PostCardData | null> {
  const row = unwrap(await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle()) as unknown as PostCardData | null;
  if (!row) return null;
  const [decorated] = await decorate(userId, [row]);
  return decorated ?? null;
}

export async function fetchUserPosts(viewerId: string | null, authorId: string, before?: string | null): Promise<PostCardData[]> {
  let q = supabase.from('posts').select(POST_SELECT).eq('author_id', authorId).order('created_at', { ascending: false }).limit(FEED_PAGE);
  if (before) q = q.lt('created_at', before);
  const rows = unwrap(await q) as unknown as PostCardData[];
  return decorate(viewerId, rows);
}

export async function fetchSavedPosts(userId: string): Promise<PostCardData[]> {
  const rows = unwrap(
    await supabase.from('post_saves').select('post_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
  );
  return fetchPostsByIds(
    userId,
    rows.map((r) => r.post_id),
  );
}

export async function createPost(args: {
  body: string;
  visibility: 'public' | 'followers' | 'friends';
  media: UploadedMedia[];
  productIds: string[];
}): Promise<string> {
  return unwrap(
    await supabase.rpc('create_post', {
      p_body: args.body,
      p_visibility: args.visibility,
      p_media: args.media as unknown as never,
      p_product_ids: args.productIds,
    }),
  ) as string;
}

export async function editPost(id: string, body: string) {
  unwrap(await supabase.from('posts').update({ body }).eq('id', id));
}

export async function deletePost(id: string) {
  unwrap(await supabase.rpc('delete_post', { p_post_id: id }));
}

export async function setLike(userId: string, postId: string, like: boolean) {
  if (like) {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    unwrap(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId));
  }
}

export async function setSave(userId: string, postId: string, save: boolean) {
  if (save) {
    const { error } = await supabase.from('post_saves').insert({ post_id: postId, user_id: userId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    unwrap(await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', userId));
  }
}

export async function fetchComments(postId: string): Promise<CommentRow[]> {
  return unwrap(
    await supabase
      .from('comments')
      .select(`*, author:profiles!comments_author_id_fkey(${PROFILE_LITE})`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(300),
  ) as unknown as CommentRow[];
}

export async function addComment(userId: string, postId: string, body: string, parentId?: string | null) {
  unwrap(await supabase.from('comments').insert({ post_id: postId, author_id: userId, body, parent_id: parentId ?? null }));
}

export async function deleteComment(id: string) {
  unwrap(await supabase.rpc('delete_comment', { p_comment_id: id }));
}
