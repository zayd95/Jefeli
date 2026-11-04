import { supabase, unwrap } from '../supabase';
import type { ProfileLite } from '../types';
import { PROFILE_LITE } from './profiles';

export type NotificationItem = {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor: ProfileLite | null;
};

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select(`id, type, entity_type, entity_id, data, read_at, created_at, actor:profiles!notifications_actor_id_fkey(${PROFILE_LITE})`)
      .eq('recipient_id', userId)
      .not('type', 'in', '(message,story_reply)')
      .order('created_at', { ascending: false })
      .limit(80),
  ) as unknown as NotificationItem[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)
    .not('type', 'in', '(message,story_reply)');
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead() {
  unwrap(await supabase.rpc('mark_all_notifications_read'));
}
