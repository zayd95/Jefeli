/**
 * Stream Video webhook receiver. Session state (EN DIRECT / ended / viewer counts) is only
 * ever updated from here or from a server-side provider query — never by a client.
 *
 * Security: the request must carry X-SIGNATURE = HMAC-SHA256(raw body, STREAM_API_SECRET)
 * and X-API-KEY = STREAM_API_KEY. Anything else is rejected with 401.
 * Configure in the Stream dashboard: webhook URL = <SUPABASE_URL>/functions/v1/live-webhook
 * (deploy this function with --no-verify-jwt: the provider does not send a Supabase JWT).
 */
import { hmacHex, safeEqual } from '../_shared/jwt.ts';
import { json } from '../_shared/http.ts';
import { streamConfig } from '../_shared/stream.ts';
import { admin } from '../_shared/supabase.ts';

type StreamEvent = {
  type?: string;
  call_cid?: string;
  call?: { id?: string; session?: { participants?: unknown[]; anonymous_participant_count?: number } | null };
  participants_count_by_role?: Record<string, number>;
  anonymous_participant_count?: number;
};

function callIdOf(e: StreamEvent): string | null {
  if (e.call?.id) return e.call.id;
  if (e.call_cid?.includes(':')) return e.call_cid.split(':')[1] ?? null;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const cfg = streamConfig();
  if (!cfg) return json({ error: 'provider_not_configured' }, 503);

  const raw = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  const apiKey = req.headers.get('x-api-key') ?? '';
  const expected = await hmacHex(raw, cfg.secret);
  if (!signature || !safeEqual(signature.toLowerCase(), expected) || apiKey !== cfg.apiKey) {
    return json({ error: 'invalid_signature' }, 401);
  }

  let event: StreamEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const callId = callIdOf(event);
  if (!callId) return json({ ok: true, ignored: 'no_call' });

  let status: 'live' | 'ended' | null = null;
  let viewers: number | null = null;
  switch (event.type) {
    case 'call.live_started':
      status = 'live';
      break;
    case 'call.ended':
    case 'call.session_ended':
    case 'call.deleted':
      status = 'ended';
      break;
    case 'call.session_participant_count_updated': {
      const byRole = event.participants_count_by_role ?? {};
      const hosts = byRole.host ?? 0;
      const total = Object.values(byRole).reduce((a, b) => a + b, 0);
      viewers = Math.max(0, total - hosts) + (event.anonymous_participant_count ?? 0);
      break;
    }
    default:
      return json({ ok: true, ignored: event.type ?? 'unknown' });
  }

  const db = admin();
  const session = await db.maybeOne<{ status: string }>('live_sessions', `select=status&provider_call_id=eq.${encodeURIComponent(callId)}`);
  if (!session) return json({ ok: true, ignored: 'unknown_call' });
  const nextStatus = status ?? (session.status as 'created' | 'live' | 'ended');
  try {
    await db.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: nextStatus, p_viewer_count: viewers });
  } catch (e) {
    console.error('apply_state_failed', String(e));
    return json({ error: 'apply_failed' }, 500);
  }
  return json({ ok: true });
});
