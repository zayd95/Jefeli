/**
 * Realtime subscriptions (Supabase postgres_changes; RLS is enforced per subscriber, so a
 * non-member never receives another conversation's rows).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from './supabase';

/** Keep inbox badge + conversation list fresh while signed in. */
export function useInboxRealtime(userId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['unread-messages'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['unread-notifications'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

/** Live updates inside one conversation: new messages, offers changing state, read receipts. */
export function useConversationRealtime(conversationId: string | undefined, onMessage?: () => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
        onMessage?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ['offers', conversationId] });
        qc.invalidateQueries({ queryKey: ['agreements', conversationId] });
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ['conversation', conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc, onMessage]);
}

export function useLiveRealtime(sessionId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`live:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_comments', filter: `live_session_id=eq.${sessionId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live-comments', sessionId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_pins', filter: `live_session_id=eq.${sessionId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live-pin', sessionId] }),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live', sessionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);
}
