/**
 * POST /functions/v1/live   { action: 'status' | 'create' | 'token' | 'sync' | 'end', ... }
 *
 * status : public — is the live provider configured and the feature flag on?
 * create : host starts a session { title } → session row + provider call + host token
 * token  : viewer/host gets a short-lived provider token for a session they may see
 * sync   : refresh real state (live/ended/viewers) from the provider (fallback when
 *          webhooks are not configured, e.g. local development)
 * end    : host ends the session at the provider and in the database
 */
import { json, preflight } from '../_shared/http.ts';
import { CALL_TYPE, createLivestream, endCall, getCallState, streamConfig, upsertUser, userToken } from '../_shared/stream.ts';
import { admin, getCaller } from '../_shared/supabase.ts';

async function flagEnabled(): Promise<boolean> {
  const row = await admin().maybeOne<{ enabled: boolean }>('feature_flags', 'select=enabled&key=eq.live_streaming');
  return row?.enabled === true;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const action = String(body.action ?? '');
  const cfg = streamConfig();

  if (action === 'status') {
    const enabled = await flagEnabled();
    return json({
      provider: 'stream',
      configured: !!cfg && enabled,
      reason: !cfg ? 'provider_not_configured' : !enabled ? 'feature_disabled' : undefined,
    });
  }

  const caller = await getCaller(req);
  if (!caller) return json({ error: 'not_authenticated' }, 401);
  if (!cfg) return json({ error: 'provider_not_configured' }, 503);
  if (!(await flagEnabled())) return json({ error: 'feature_disabled' }, 503);

  const db = admin();
  const me = await db.maybeOne<{ id: string; display_name: string; status: string }>('profiles', `select=id,display_name,status&id=eq.${caller.id}`);
  if (!me || me.status !== 'active') return json({ error: 'account_suspended' }, 403);

  try {
    if (action === 'create') {
      const title = String(body.title ?? '').trim().slice(0, 80);
      if (!title) return json({ error: 'invalid_title' }, 400);
      const callId = crypto.randomUUID();
      let session: { id: string };
      try {
        session = await db.insert('live_sessions', { host_id: caller.id, title, provider: 'stream', provider_call_type: CALL_TYPE, provider_call_id: callId });
      } catch (e) {
        return json({ error: /one_active_per_host|duplicate/.test(String(e)) ? 'live_already_active' : 'create_failed' }, 409);
      }
      try {
        await upsertUser({ id: caller.id, name: me.display_name });
        await createLivestream(callId, caller.id, session.id);
      } catch (e) {
        await db.update('live_sessions', `id=eq.${session.id}`, { status: 'ended', ended_at: new Date().toISOString() });
        throw e;
      }
      return json({ session, apiKey: cfg.apiKey, token: await userToken(caller.id, cfg.secret), callType: CALL_TYPE, callId });
    }

    const sessionId = String(body.sessionId ?? '');
    // Visibility is checked with the CALLER's RLS (blocks, privacy, moderation).
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: 'not_found' }, 404);
    const visible = await caller.db.maybeOne<{ id: string; host_id: string; status: string; provider_call_id: string }>(
      'live_sessions',
      `select=id,host_id,status,provider_call_id&id=eq.${sessionId}`,
    );
    if (!visible) return json({ error: 'not_found' }, 404);

    if (action === 'token') {
      if (visible.status === 'ended') return json({ error: 'live_not_active' }, 409);
      // Best effort: the client SDK also sends the user profile when it connects.
      await upsertUser({ id: caller.id, name: me.display_name }).catch((e) => console.error('upsert_user_failed', String(e)));
      return json({ apiKey: cfg.apiKey, token: await userToken(caller.id, cfg.secret, 60 * 60), callType: CALL_TYPE, callId: visible.provider_call_id, isHost: visible.host_id === caller.id });
    }

    if (action === 'sync') {
      const state = await getCallState(visible.provider_call_id);
      const status = state.ended ? 'ended' : state.live ? 'live' : 'created';
      await db.rpc('live_apply_provider_state', { p_provider_call_id: visible.provider_call_id, p_status: status, p_viewer_count: state.viewers });
      return json({ status, viewers: state.viewers });
    }

    if (action === 'end') {
      if (visible.host_id !== caller.id) return json({ error: 'not_allowed' }, 403);
      await endCall(visible.provider_call_id).catch((e) => console.error('end_call_failed', String(e)));
      await db.rpc('live_apply_provider_state', { p_provider_call_id: visible.provider_call_id, p_status: 'ended', p_viewer_count: null });
      return json({ status: 'ended' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'provider_error';
    return json({ error: msg.startsWith('provider_') ? msg : 'provider_error' }, 502);
  }
});

