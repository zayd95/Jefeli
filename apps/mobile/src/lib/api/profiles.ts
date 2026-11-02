import { supabase, unwrap } from '../supabase';
import type { ProfileLite, ProfileRow } from '../types';

export const PROFILE_LITE = 'id, handle, display_name, avatar_path, verification_level, is_demo, city';

export async function fetchMyProfile(userId: string): Promise<ProfileRow> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single());
}

export async function getProfileByHandle(handle: string): Promise<ProfileRow | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('handle', handle.toLowerCase()).maybeSingle());
}

export async function getProfile(id: string): Promise<ProfileRow | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
}

export async function getProfilesByIds(ids: string[]): Promise<Record<string, ProfileLite>> {
  if (ids.length === 0) return {};
  const rows = unwrap(await supabase.from('profiles').select(PROFILE_LITE).in('id', ids)) as ProfileLite[];
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    | 'handle'
    | 'display_name'
    | 'bio'
    | 'avatar_path'
    | 'cover_path'
    | 'city'
    | 'neighborhood'
    | 'interests'
    | 'is_private'
    | 'is_merchant'
    | 'onboarded_at'
    | 'adult_confirmed_at'
  >
>;

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<void> {
  unwrap(await supabase.from('profiles').update(patch).eq('id', userId));
}

export async function isHandleAvailable(handle: string, myId: string): Promise<boolean> {
  const row = unwrap(await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle()) as { id: string } | null;
  return !row || row.id === myId;
}

export interface Relationship {
  authenticated: boolean;
  is_self?: boolean;
  follow_status?: 'accepted' | 'pending' | null;
  follows_me?: boolean;
  is_friend?: boolean;
  friend_request_id?: string | null;
  friend_request_direction?: 'incoming' | 'outgoing' | null;
  blocked?: boolean;
  blocked_by?: boolean;
  muted?: boolean;
}

export async function getRelationship(target: string): Promise<Relationship> {
  return unwrap(await supabase.rpc('relationship_with', { p_target: target })) as unknown as Relationship;
}

export async function follow(me: string, target: string) {
  unwrap(await supabase.from('follows').insert({ follower_id: me, followee_id: target }));
}
export async function unfollow(me: string, target: string) {
  unwrap(await supabase.from('follows').delete().eq('follower_id', me).eq('followee_id', target));
}
export async function acceptFollowRequest(me: string, follower: string) {
  unwrap(await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', follower).eq('followee_id', me));
}
export async function removeFollower(me: string, follower: string) {
  unwrap(await supabase.from('follows').delete().eq('follower_id', follower).eq('followee_id', me));
}

export async function sendFriendRequest(target: string): Promise<string> {
  return unwrap(await supabase.rpc('send_friend_request', { p_target: target })) as string;
}
export async function respondFriendRequest(id: string, accept: boolean) {
  return unwrap(await supabase.rpc('respond_friend_request', { p_request_id: id, p_accept: accept }));
}
export async function cancelFriendRequest(id: string) {
  unwrap(await supabase.rpc('cancel_friend_request', { p_request_id: id }));
}
export async function removeFriend(other: string) {
  unwrap(await supabase.rpc('remove_friend', { p_other: other }));
}

export async function block(me: string, target: string) {
  unwrap(await supabase.from('blocks').insert({ blocker_id: me, blocked_id: target }));
}
export async function unblock(me: string, target: string) {
  unwrap(await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', target));
}
export async function mute(me: string, target: string) {
  unwrap(await supabase.from('mutes').insert({ muter_id: me, muted_id: target }));
}
export async function unmute(me: string, target: string) {
  unwrap(await supabase.from('mutes').delete().eq('muter_id', me).eq('muted_id', target));
}

export async function listBlocked(me: string): Promise<ProfileLite[]> {
  const rows = unwrap(
    await supabase.from('blocks').select(`created_at, blocked:profiles!blocks_blocked_id_fkey(${PROFILE_LITE})`).eq('blocker_id', me),
  ) as unknown as { blocked: ProfileLite | null }[];
  return rows.map((r) => r.blocked).filter((p): p is ProfileLite => !!p);
}

export type ConnectionKind = 'followers' | 'following' | 'friends' | 'requests';

export async function listConnections(userId: string, kind: ConnectionKind): Promise<ProfileLite[]> {
  if (kind === 'followers' || kind === 'requests') {
    const rows = unwrap(
      await supabase
        .from('follows')
        .select(`created_at, p:profiles!follows_follower_id_fkey(${PROFILE_LITE})`)
        .eq('followee_id', userId)
        .eq('status', kind === 'requests' ? 'pending' : 'accepted')
        .order('created_at', { ascending: false })
        .limit(200),
    ) as unknown as { p: ProfileLite | null }[];
    return rows.map((r) => r.p).filter((p): p is ProfileLite => !!p);
  }
  if (kind === 'following') {
    const rows = unwrap(
      await supabase
        .from('follows')
        .select(`created_at, p:profiles!follows_followee_id_fkey(${PROFILE_LITE})`)
        .eq('follower_id', userId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(200),
    ) as unknown as { p: ProfileLite | null }[];
    return rows.map((r) => r.p).filter((p): p is ProfileLite => !!p);
  }
  const rows = unwrap(
    await supabase
      .from('friendships')
      .select(`a:profiles!friendships_user_a_fkey(${PROFILE_LITE}), b:profiles!friendships_user_b_fkey(${PROFILE_LITE})`)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(200),
  ) as unknown as { a: ProfileLite | null; b: ProfileLite | null }[];
  return rows.map((r) => (r.a?.id === userId ? r.b : r.a)).filter((p): p is ProfileLite => !!p);
}

export interface FriendRequestItem {
  id: string;
  created_at: string;
  sender: ProfileLite | null;
}

export async function incomingFriendRequests(me: string): Promise<FriendRequestItem[]> {
  return unwrap(
    await supabase
      .from('friend_requests')
      .select(`id, created_at, sender:profiles!friend_requests_sender_id_fkey(${PROFILE_LITE})`)
      .eq('receiver_id', me)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ) as unknown as FriendRequestItem[];
}

export async function searchProfiles(query: string, city?: string | null): Promise<ProfileRow[]> {
  return unwrap(await supabase.rpc('search_profiles', { p_query: query, p_city: city ?? undefined, p_limit: 30 })) as ProfileRow[];
}

export async function getSettings(userId: string) {
  return unwrap(await supabase.from('account_settings').select('*').eq('user_id', userId).single());
}

export async function updateSettings(
  userId: string,
  patch: Partial<{
    default_status_audience: string;
    allow_messages_from: string;
    notify_push: boolean;
    notify_messages: boolean;
    notify_offers: boolean;
    notify_social: boolean;
    notify_live: boolean;
  }>,
) {
  unwrap(await supabase.from('account_settings').update(patch).eq('user_id', userId));
}
