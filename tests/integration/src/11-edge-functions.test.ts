/**
 * Edge Functions (supabase/functions), exercised through the local gateway.
 *
 * The provider tests need the functions served with FAKE Stream credentials:
 *   supabase functions serve --env-file supabase/functions/.env.test
 * Without them, those tests are skipped and the "not configured" behaviour is asserted.
 */
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env';
import { adminClient, createStory, createUser, follow, must, notificationsOf, psql, uploadImage, type TestUser } from './helpers';

const FN = `${SUPABASE_URL}/functions/v1`;
const TEST_STREAM_KEY = 'test_stream_key';
const TEST_STREAM_SECRET = 'test_stream_secret_not_real';
const TEST_PUSH_SECRET = 'test-push-secret';

async function call(name: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function verifyHs256(token: string, secret: string): Record<string, unknown> {
  const [h, p, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  expect(sig).toBe(expected);
  return JSON.parse(Buffer.from(p as string, 'base64url').toString('utf8'));
}

let providerConfigured = false;

beforeAll(async () => {
  const status = await call('live', { action: 'status' });
  expect(status.status).toBe(200);
  // With fake creds the provider is "configured" but the feature flag is still off.
  providerConfigured = status.json.reason === 'feature_disabled' || status.json.configured === true;
});

describe('live — honest provider state', () => {
  it('status never claims Live is available without provider credentials AND the feature flag', async () => {
    const r = await call('live', { action: 'status' });
    expect(r.json.configured).toBe(false);
    expect(['provider_not_configured', 'feature_disabled']).toContain(r.json.reason);
  });

  it('create/token require an authenticated caller', async () => {
    expect((await call('live', { action: 'create', title: 'x' })).json.error).toBe('not_authenticated');
    expect((await call('live', { action: 'token', sessionId: crypto.randomUUID() })).status).toBe(401);
  });
});

describe('live — tokens and webhook (fake provider credentials)', () => {
  let H: TestUser; // host
  let F: TestUser; // follower
  let C: TestUser; // blocked by host
  let sessionId: string;
  const callId = crypto.randomUUID();

  beforeAll(async () => {
    if (!providerConfigured) return;
    [H, F, C] = await Promise.all([createUser('live-h'), createUser('live-f'), createUser('live-c')]);
    await follow(F, H);
    must(await H.client.from('blocks').insert({ blocker_id: H.id, blocked_id: C.id }));
    const row = must(
      await adminClient
        .from('live_sessions')
        .insert({ host_id: H.id, title: 'Arrivage du jour', provider_call_id: callId })
        .select('id')
        .single(),
    ) as { id: string };
    sessionId = row.id;
    must(await adminClient.from('feature_flags').update({ enabled: true }).eq('key', 'live_streaming'));
  });

  afterAll(async () => {
    if (providerConfigured) await adminClient.from('feature_flags').update({ enabled: false }).eq('key', 'live_streaming');
  });

  it('a visible session yields a short-lived token signed for the caller only', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const r = await call('live', { action: 'token', sessionId }, { Authorization: `Bearer ${F.accessToken}` });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.apiKey).toBe(TEST_STREAM_KEY);
    expect(r.json.callId).toBe(callId);
    expect(JSON.stringify(r.json)).not.toContain(TEST_STREAM_SECRET);
    const payload = verifyHs256(String(r.json.token), TEST_STREAM_SECRET);
    expect(payload.user_id).toBe(F.id);
    const ttl = Number(payload.exp) - Math.floor(Date.now() / 1000);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('a member the host blocked cannot obtain a token (RLS on the session)', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const r = await call('live', { action: 'token', sessionId }, { Authorization: `Bearer ${C.accessToken}` });
    expect(r.status).toBe(404);
  });

  it('only the host can end the session', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const r = await call('live', { action: 'end', sessionId }, { Authorization: `Bearer ${F.accessToken}` });
    expect(r.status).toBe(403);
  });

  it('webhook rejects a bad signature and wrong API key', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const body = JSON.stringify({ type: 'call.live_started', call_cid: `livestream:${callId}` });
    const bad = await call('live-webhook', body, { 'x-signature': 'deadbeef', 'x-api-key': TEST_STREAM_KEY });
    expect(bad.status).toBe(401);
    const sig = createHmac('sha256', TEST_STREAM_SECRET).update(body).digest('hex');
    const wrongKey = await call('live-webhook', body, { 'x-signature': sig, 'x-api-key': 'other' });
    expect(wrongKey.status).toBe(401);
    const s = must(await adminClient.from('live_sessions').select('status').eq('id', sessionId).single()) as { status: string };
    expect(s.status).toBe('created');
  });

  it('signed provider events drive EN DIRECT, viewer counts and the end', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const send = async (event: Record<string, unknown>) => {
      const body = JSON.stringify(event);
      const sig = createHmac('sha256', TEST_STREAM_SECRET).update(body).digest('hex');
      return call('live-webhook', body, { 'x-signature': sig, 'x-api-key': TEST_STREAM_KEY });
    };
    expect((await send({ type: 'call.live_started', call_cid: `livestream:${callId}` })).status).toBe(200);
    let s = must(await adminClient.from('live_sessions').select('status, started_at').eq('id', sessionId).single()) as Record<string, unknown>;
    expect(s.status).toBe('live');
    expect(s.started_at).toBeTruthy();
    // Followers are notified exactly once, only because the provider said so.
    expect((await notificationsOf(F, 'live_started')).length).toBe(1);

    expect((await send({ type: 'call.session_participant_count_updated', call_cid: `livestream:${callId}`, participants_count_by_role: { host: 1, user: 3 }, anonymous_participant_count: 0 })).status).toBe(200);
    s = must(await adminClient.from('live_sessions').select('viewer_count').eq('id', sessionId).single()) as Record<string, unknown>;
    expect(s.viewer_count).toBe(3);

    expect((await send({ type: 'call.ended', call: { id: callId } })).status).toBe(200);
    s = must(await adminClient.from('live_sessions').select('status, viewer_count, ended_at').eq('id', sessionId).single()) as Record<string, unknown>;
    expect(s.status).toBe('ended');
    expect(s.viewer_count).toBeNull();
    expect(s.ended_at).toBeTruthy();

    // A late "live_started" cannot resurrect an ended session.
    await send({ type: 'call.live_started', call_cid: `livestream:${callId}` });
    s = must(await adminClient.from('live_sessions').select('status').eq('id', sessionId).single()) as Record<string, unknown>;
    expect(s.status).toBe('ended');
  });
});

describe('push-dispatch — shared-secret protected', () => {
  it('rejects calls without the webhook secret', async () => {
    expect((await call('push-dispatch', { notification_id: crypto.randomUUID() })).status).toBe(401);
    expect((await call('push-dispatch', { notification_id: crypto.randomUUID() }, { 'x-jefeli-webhook-secret': 'wrong' })).status).toBe(401);
  });

  it('skips recipients without registered devices', async (ctx) => {
    if (!providerConfigured) ctx.skip();
    const [A, B] = await Promise.all([createUser('push-a'), createUser('push-b')]);
    await follow(A, B);
    const [n] = await notificationsOf(B, 'follow');
    const r = await call('push-dispatch', { notification_id: n?.id }, { 'x-jefeli-webhook-secret': TEST_PUSH_SECRET });
    expect(r.status).toBe(200);
    expect(r.json.skipped).toBe('no_device');
  });
});

describe('cleanup-stories — service key only', () => {
  it('rejects anonymous calls', async () => {
    expect((await call('cleanup-stories', {})).status).toBe(401);
  });

  it('soft-deletes expired, non-highlighted statuses and removes their files', async () => {
    const B = await createUser('cleanup-b');
    const story = await createStory(B, 'public', 'Expirera');
    psql(`update public.stories set expires_at = now() - interval '1 hour' where id = '${story.id}'`);
    const r = await call('cleanup-stories', {}, { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(Number(r.json.statuses)).toBeGreaterThanOrEqual(1);
    expect(psql(`select deleted_at is not null from public.stories where id = '${story.id}'`)).toBe('t');
    expect(psql(`select count(*) from storage.objects where bucket_id = 'private-media' and name = '${story.mediaPath}'`)).toBe('0');
  });
});

describe('delete-account — the caller deletes only themselves', () => {
  it('requires authentication and explicit confirmation', async () => {
    expect((await call('delete-account', { confirm: true })).status).toBe(401);
    const U = await createUser('del-confirm');
    expect((await call('delete-account', {}, { Authorization: `Bearer ${U.accessToken}` })).status).toBe(400);
  });

  it('removes files in every bucket, the profile and the auth user', async () => {
    const U = await createUser('del-me');
    const avatar = await uploadImage(U, 'avatars');
    const priv = await uploadImage(U, 'private-media');
    const r = await call('delete-account', { confirm: true }, { Authorization: `Bearer ${U.accessToken}` });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(Number(r.json.files_removed)).toBeGreaterThanOrEqual(2);
    expect(psql(`select count(*) from auth.users where id = '${U.id}'`)).toBe('0');
    expect(psql(`select count(*) from public.profiles where id = '${U.id}'`)).toBe('0');
    expect(psql(`select count(*) from storage.objects where name in ('${avatar}', '${priv}')`)).toBe('0');
  });
});
