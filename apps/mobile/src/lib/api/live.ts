import { env } from '../env';
import { supabase, unwrap } from '../supabase';
import type { ProductCard, ProfileLite } from '../types';
import { PRODUCT_SELECT } from './products';
import { PROFILE_LITE } from './profiles';

export type LiveSessionRow = {
  id: string;
  host_id: string;
  title: string;
  status: 'created' | 'live' | 'ended' | string;
  provider: string;
  provider_call_type: string;
  provider_call_id: string;
  viewer_count: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  host: ProfileLite | null;
};

const LIVE_SELECT = `*, host:profiles!live_sessions_host_id_fkey(${PROFILE_LITE})`;

export async function fetchLiveNow(): Promise<LiveSessionRow[]> {
  return unwrap(
    await supabase.from('live_sessions').select(LIVE_SELECT).eq('status', 'live').order('started_at', { ascending: false }).limit(30),
  ) as unknown as LiveSessionRow[];
}

export async function fetchLiveSession(id: string): Promise<LiveSessionRow | null> {
  return unwrap(await supabase.from('live_sessions').select(LIVE_SELECT).eq('id', id).maybeSingle()) as unknown as LiveSessionRow | null;
}

export async function fetchLiveByHost(hostId: string): Promise<LiveSessionRow[]> {
  return unwrap(
    await supabase.from('live_sessions').select(LIVE_SELECT).eq('host_id', hostId).order('created_at', { ascending: false }).limit(20),
  ) as unknown as LiveSessionRow[];
}

export type LiveComment = { id: string; body: string; created_at: string; author_id: string; moderation_status: string; author: ProfileLite | null };

export async function fetchLiveComments(sessionId: string): Promise<LiveComment[]> {
  const rows = unwrap(
    await supabase
      .from('live_comments')
      .select(`id, body, created_at, author_id, moderation_status, author:profiles!live_comments_author_id_fkey(${PROFILE_LITE})`)
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50),
  ) as unknown as LiveComment[];
  return rows.reverse();
}

export async function postLiveComment(userId: string, sessionId: string, body: string) {
  unwrap(await supabase.from('live_comments').insert({ live_session_id: sessionId, author_id: userId, body }));
}

export async function fetchCurrentPin(sessionId: string): Promise<ProductCard | null> {
  const row = unwrap(
    await supabase
      .from('live_pins')
      .select(`id, product:products(${PRODUCT_SELECT})`)
      .eq('live_session_id', sessionId)
      .is('unpinned_at', null)
      .order('pinned_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as unknown as { product: ProductCard | null } | null;
  return row?.product ?? null;
}

export async function pinProduct(sessionId: string, productId: string) {
  unwrap(await supabase.rpc('pin_live_product', { p_session_id: sessionId, p_product_id: productId }));
}
export async function unpinProduct(sessionId: string) {
  unwrap(await supabase.rpc('unpin_live_product', { p_session_id: sessionId }));
}
export async function hideLiveComment(commentId: string) {
  unwrap(await supabase.rpc('hide_live_comment', { p_comment_id: commentId }));
}
export async function muteInLive(sessionId: string, userId: string, mute: boolean) {
  unwrap(await supabase.rpc('mute_in_live', { p_session_id: sessionId, p_user_id: userId, p_mute: mute }));
}

/** Calls the trusted `live` Edge Function (mints provider tokens server-side). */
export async function liveFunction<T>(action: 'status' | 'create' | 'token' | 'end', body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${env.supabaseUrl}/functions/v1/live`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseKey,
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `http_${res.status}`);
  return json;
}

export type LiveProviderStatus = { configured: boolean; provider: string; reason?: string };
