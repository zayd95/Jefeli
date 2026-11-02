import { supabase, unwrap } from '../supabase';
import type { AgreementRow, ConversationSummary, MessageRow, OfferRow, ProfileLite } from '../types';
import { getProfilesByIds, PROFILE_LITE } from './profiles';

export const MESSAGE_PAGE = 40;

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const rows = unwrap(await supabase.rpc('my_conversations')) as Omit<ConversationSummary, 'other'>[];
  const profiles = await getProfilesByIds(rows.map((r) => r.other_user_id));
  return rows.map((r) => ({ ...r, other: profiles[r.other_user_id] ?? null }));
}

export async function fetchUnreadCount(): Promise<number> {
  return (unwrap(await supabase.rpc('unread_messages_count')) as number) ?? 0;
}

export interface ConversationInfo {
  id: string;
  members: { user_id: string; last_read_at: string; muted: boolean; profile: ProfileLite | null }[];
}

export async function fetchConversation(id: string): Promise<ConversationInfo | null> {
  const conv = unwrap(await supabase.from('conversations').select('id').eq('id', id).maybeSingle()) as { id: string } | null;
  if (!conv) return null;
  const members = unwrap(
    await supabase
      .from('conversation_members')
      .select(`user_id, last_read_at, muted, profile:profiles!conversation_members_user_id_fkey(${PROFILE_LITE})`)
      .eq('conversation_id', id),
  ) as unknown as ConversationInfo['members'];
  return { id: conv.id, members };
}

export async function fetchMessages(conversationId: string, before?: string | null): Promise<MessageRow[]> {
  let q = supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(MESSAGE_PAGE);
  if (before) q = q.lt('created_at', before);
  return unwrap(await q);
}

export async function fetchOffersForConversation(conversationId: string): Promise<OfferRow[]> {
  return unwrap(await supabase.from('offers').select('*').eq('conversation_id', conversationId).order('created_at'));
}

export async function fetchAgreementsForConversation(conversationId: string): Promise<AgreementRow[]> {
  return unwrap(await supabase.from('agreements').select('*').eq('conversation_id', conversationId).order('created_at'));
}

export async function sendText(userId: string, conversationId: string, body: string): Promise<MessageRow> {
  return unwrap(
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, kind: 'text', body }).select('*').single(),
  );
}

export async function sendAttachment(
  userId: string,
  conversationId: string,
  kind: 'image' | 'voice',
  path: string,
  meta: Record<string, unknown>,
): Promise<MessageRow> {
  return unwrap(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, kind, attachment_path: path, attachment_meta: meta as never, body: '' })
      .select('*')
      .single(),
  );
}

export async function sendProductCard(userId: string, conversationId: string, productId: string): Promise<MessageRow> {
  return unwrap(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, kind: 'product', product_id: productId, body: '' })
      .select('*')
      .single(),
  );
}

export async function openConversationWith(otherUserId: string): Promise<string> {
  return unwrap(await supabase.rpc('get_or_create_conversation', { p_other: otherUserId })) as string;
}

export async function messageAboutProduct(productId: string, body?: string): Promise<string> {
  return unwrap(await supabase.rpc('message_about_product', { p_product_id: productId, p_body: body ?? undefined })) as string;
}

export async function markConversationRead(userId: string, conversationId: string) {
  unwrap(
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId),
  );
}

export async function setConversationMuted(userId: string, conversationId: string, muted: boolean) {
  unwrap(await supabase.from('conversation_members').update({ muted }).eq('conversation_id', conversationId).eq('user_id', userId));
}

export async function hideConversation(userId: string, conversationId: string) {
  unwrap(
    await supabase
      .from('conversation_members')
      .update({ hidden_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId),
  );
}

export async function deleteMessage(id: string) {
  unwrap(await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id));
}
