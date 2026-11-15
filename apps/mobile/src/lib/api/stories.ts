import { supabase, unwrap } from '../supabase';
import type { ProfileLite, StoryRow } from '../types';
import { getProfilesByIds, PROFILE_LITE } from './profiles';

export interface RailItem {
  author_id: string;
  latest_at: string;
  story_count: number;
  has_unseen: boolean;
  author: ProfileLite | null;
}

export async function fetchStoryRail(): Promise<RailItem[]> {
  const rows = unwrap(await supabase.rpc('get_story_rail')) as Omit<RailItem, 'author'>[];
  const profiles = await getProfilesByIds(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: profiles[r.author_id] ?? null }));
}

/** Currently visible (unexpired) statuses of a member, oldest first for playback. */
export async function fetchActiveStories(authorId: string): Promise<StoryRow[]> {
  return unwrap(
    await supabase
      .from('stories')
      .select('*')
      .eq('author_id', authorId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true }),
  );
}

export async function fetchStoriesByIds(ids: string[]): Promise<StoryRow[]> {
  if (!ids.length) return [];
  const rows = unwrap(await supabase.from('stories').select('*').in('id', ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((s): s is StoryRow => !!s);
}

export async function createStory(args: {
  media_kind: 'image' | 'video' | 'audio';
  path: string;
  poster_path?: string | null;
  width: number | null;
  height: number | null;
  duration_ms?: number | null;
  caption: string;
  audience: 'public' | 'followers' | 'friends';
  product_id?: string | null;
}): Promise<string> {
  return unwrap(
    await supabase.rpc('create_story', {
      p_media_kind: args.media_kind,
      p_path: args.path,
      p_poster_path: args.poster_path ?? (null as unknown as string),
      p_width: args.width as number,
      p_height: args.height as number,
      p_duration_ms: args.duration_ms ?? (null as unknown as number),
      p_caption: args.caption,
      p_audience: args.audience,
      p_product_id: args.product_id ?? undefined,
    }),
  ) as string;
}

/** A 24-hour status that points to one of your publications or articles (no file is copied). */
export async function shareToStatus(args: { postId?: string; productId?: string; caption?: string; audience: 'public' | 'followers' | 'friends' }): Promise<string> {
  return unwrap(
    await supabase.rpc('share_to_status', {
      p_post_id: args.postId ?? undefined,
      p_product_id: args.productId ?? undefined,
      p_caption: args.caption ?? '',
      p_audience: args.audience,
    }),
  ) as string;
}

export async function markStoryViewed(userId: string, storyId: string) {
  const { error } = await supabase.from('story_views').insert({ story_id: storyId, viewer_id: userId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function likeStory(userId: string, storyId: string, like: boolean) {
  if (like) {
    const { error } = await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    unwrap(await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId));
  }
}

export async function replyToStory(storyId: string, body: string): Promise<string> {
  return unwrap(await supabase.rpc('reply_to_story', { p_story_id: storyId, p_body: body })) as string;
}

export async function deleteStory(id: string) {
  unwrap(await supabase.rpc('delete_story', { p_story_id: id }));
}

export async function fetchStoryViewers(storyId: string): Promise<{ viewed_at: string; viewer: ProfileLite | null }[]> {
  return unwrap(
    await supabase
      .from('story_views')
      .select(`viewed_at, viewer:profiles!story_views_viewer_id_fkey(${PROFILE_LITE})`)
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false }),
  ) as unknown as { viewed_at: string; viewer: ProfileLite | null }[];
}

export interface HighlightWithItems {
  id: string;
  title: string;
  owner_id: string;
  position: number;
  items: { story_id: string; position: number; story: StoryRow | null }[];
}

export async function fetchHighlights(ownerId: string): Promise<HighlightWithItems[]> {
  return unwrap(
    await supabase
      .from('highlights')
      .select('id, title, owner_id, position, items:highlight_items(story_id, position, story:stories(*))')
      .eq('owner_id', ownerId)
      .order('position'),
  ) as unknown as HighlightWithItems[];
}

export async function addToHighlight(userId: string, storyId: string, title: string): Promise<void> {
  const existing = unwrap(await supabase.from('highlights').select('id').eq('owner_id', userId).eq('title', title).maybeSingle()) as { id: string } | null;
  let highlightId = existing?.id;
  if (!highlightId) {
    const created = unwrap(await supabase.from('highlights').insert({ owner_id: userId, title }).select('id').single()) as { id: string };
    highlightId = created.id;
  }
  const { error } = await supabase.from('highlight_items').insert({ highlight_id: highlightId, story_id: storyId });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function removeHighlight(id: string) {
  unwrap(await supabase.from('highlights').delete().eq('id', id));
}
