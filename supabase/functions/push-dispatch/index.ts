/**
 * Push fan-out for one notification (called by the database via pg_net with a shared
 * secret header). Sends through the Expo Push API to the recipient's registered devices,
 * honouring their notification preferences. Lock-screen copy never contains message text.
 *
 * Required secrets: PUSH_WEBHOOK_SECRET (same value stored in private.config).
 * Optional: EXPO_ACCESS_TOKEN (if "enhanced push security" is enabled on the Expo project).
 * Deploy with --no-verify-jwt (authenticated by the shared secret instead).
 */
import { safeEqual } from '../_shared/jwt.ts';
import { json } from '../_shared/http.ts';
import { admin } from '../_shared/supabase.ts';

const CATEGORY: Record<string, 'messages' | 'offers' | 'social' | 'live' | 'system'> = {
  message: 'messages',
  story_reply: 'messages',
  offer_received: 'offers',
  offer_countered: 'offers',
  offer_accepted: 'offers',
  offer_rejected: 'offers',
  offer_withdrawn: 'offers',
  agreement_completed: 'offers',
  agreement_canceled: 'offers',
  agreement_disputed: 'offers',
  review_received: 'offers',
  live_started: 'live',
  moderation_action: 'system',
  report_resolved: 'system',
  verification_result: 'system',
  appeal_result: 'system',
};

function copy(type: string, actor: string): { title: string; body: string } {
  switch (type) {
    case 'message':
      return { title: actor, body: 'Nouveau message' };
    case 'story_reply':
      return { title: actor, body: 'a répondu à votre statut' };
    case 'follow':
      return { title: 'Nouvel abonné', body: `${actor} s’est abonné(e) à vous` };
    case 'follow_request':
      return { title: 'Demande d’abonnement', body: `${actor} souhaite vous suivre` };
    case 'friend_request':
      return { title: 'Demande d’ami', body: `${actor} vous a envoyé une demande d’ami` };
    case 'friend_accepted':
      return { title: 'Nouvel ami', body: `${actor} a accepté votre demande` };
    case 'post_upvote':
      return { title: 'Jëfëli', body: `${actor} a voté pour votre publication` };
    case 'post_comment':
    case 'comment_reply':
      return { title: 'Nouveau commentaire', body: `${actor} a commenté` };
    case 'offer_received':
      return { title: 'Nouvelle proposition', body: `${actor} vous a fait une proposition` };
    case 'offer_countered':
      return { title: 'Contre-proposition', body: `${actor} a répondu à votre proposition` };
    case 'offer_accepted':
      return { title: 'Proposition acceptée', body: `${actor} a accepté votre proposition` };
    case 'live_started':
      return { title: `${actor} est en direct`, body: 'Rejoignez le live sur Jëfëli' };
    default:
      return { title: 'Jëfëli', body: 'Vous avez une nouvelle notification' };
  }
}

function deepLink(n: { type: string; entity_type: string | null; entity_id: string | null }): string {
  switch (n.entity_type) {
    case 'conversation':
      return `/chat/${n.entity_id}`;
    case 'post':
      return `/post/${n.entity_id}`;
    case 'agreement':
      return `/agreement/${n.entity_id}`;
    case 'live_session':
      return `/live/${n.entity_id}`;
    default:
      return '/notifications';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  const provided = req.headers.get('x-jefeli-webhook-secret') ?? '';
  if (!secret || !safeEqual(secret, provided)) return json({ error: 'unauthorized' }, 401);

  const { notification_id } = (await req.json().catch(() => ({}))) as { notification_id?: string };
  if (!notification_id) return json({ error: 'invalid_body' }, 400);

  if (!/^[0-9a-f-]{36}$/i.test(notification_id)) return json({ error: 'invalid_body' }, 400);
  const db = admin();
  const n = await db.maybeOne<{ id: string; recipient_id: string; type: string; entity_type: string | null; entity_id: string | null; pushed_at: string | null; actor: { display_name?: string } | null }>(
    'notifications',
    `select=id,recipient_id,type,entity_type,entity_id,pushed_at,actor:profiles!notifications_actor_id_fkey(display_name)&id=eq.${notification_id}`,
  );
  if (!n || n.pushed_at) return json({ ok: true, skipped: 'missing_or_sent' });

  const settings = await db.maybeOne<Record<string, boolean>>('account_settings', `select=*&user_id=eq.${n.recipient_id}`);
  const cat = CATEGORY[n.type] ?? 'social';
  if (!settings?.notify_push) return json({ ok: true, skipped: 'push_disabled' });
  if (cat === 'messages' && !settings.notify_messages) return json({ ok: true, skipped: 'pref' });
  if (cat === 'offers' && !settings.notify_offers) return json({ ok: true, skipped: 'pref' });
  if (cat === 'social' && !settings.notify_social) return json({ ok: true, skipped: 'pref' });
  if (cat === 'live' && !settings.notify_live) return json({ ok: true, skipped: 'pref' });

  const tokens = await db.select<{ token: string }>('push_tokens', `select=token&user_id=eq.${n.recipient_id}`);
  if (!tokens?.length) return json({ ok: true, skipped: 'no_device' });

  const actorName = n.actor?.display_name ?? 'Jëfëli';
  const { title, body } = copy(n.type, actorName);
  const url = deepLink(n);
  const messages = tokens.map((t) => ({ to: t.token, title, body, sound: 'default', data: { url }, channelId: 'default' }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(messages) });
  } catch (e) {
    // Leave pushed_at empty so a retry can deliver later; the in-app notification exists.
    console.error('expo_push_unreachable', String(e));
    return json({ ok: false, error: 'push_provider_unreachable' }, 502);
  }
  const result = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };

  // Forget devices Expo reports as unregistered.
  const dead = (result.data ?? [])
    .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null))
    .filter((t): t is string => !!t);
  if (dead.length) await db.remove('push_tokens', `token=in.(${dead.map((t) => `"${t}"`).join(',')})`);

  await db.update('notifications', `id=eq.${n.id}`, { pushed_at: new Date().toISOString() });
  return json({ ok: res.ok, sent: messages.length, removed: dead.length });
});
