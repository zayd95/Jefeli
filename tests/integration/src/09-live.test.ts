import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  anonClient,
  canSee,
  createListing,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  follow,
  must,
  notificationsOf,
  rpc,
  token,
  type TestUser,
} from './helpers';

describe('Live commerce — server-controlled state, host tools', () => {
  let H: TestUser; // host
  let F: TestUser; // follower of the host
  let N: TestUser; // viewer who does not follow
  let O: TestUser; // another seller
  let sessionId: string;
  const callId = `it-${token(12)}`;
  let hostProduct: string;
  let otherProduct: string;
  let fComment: string;

  beforeAll(async () => {
    [H, F, N, O] = await Promise.all([createUser('host'), createUser('fan'), createUser('viewer'), createUser('other')]);
    expect(await follow(F, H)).toBe('accepted');
    hostProduct = await createListing(H, { title: 'Bazin riche 5 m', price: 35000 });
    otherProduct = await createListing(O, { title: 'Article de O', price: 1000 });
  });

  it('clients cannot create or update live sessions', async () => {
    expectPermissionDenied(
      await H.client.from('live_sessions').insert({ host_id: H.id, title: 'Mon live', provider_call_id: `fake-${token(8)}` }),
    );
    // Trusted server code (service role) creates the session.
    const row = must(
      await adminClient.from('live_sessions').insert({ host_id: H.id, title: 'Déstockage wax', provider_call_id: callId }).select('id, status').single(),
    ) as any;
    sessionId = row.id;
    expect(row.status).toBe('created');

    expectPermissionDenied(await H.client.from('live_sessions').update({ status: 'live' }).eq('id', sessionId));
    expectPermissionDenied(await H.client.from('live_sessions').update({ viewer_count: 99999 }).eq('id', sessionId));
    expectPermissionDenied(await H.client.from('live_sessions').delete().eq('id', sessionId));
    const s = must(await F.client.from('live_sessions').select('status, viewer_count').eq('id', sessionId).single()) as any;
    expect(s).toEqual({ status: 'created', viewer_count: null });
  });

  it('live_apply_provider_state is not executable by authenticated users (or anon)', async () => {
    for (const client of [H.client, F.client, anonClient()]) {
      expectPermissionDenied(
        await client.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: 'live', p_viewer_count: 5000 }),
      );
    }
    const s = must(await adminClient.from('live_sessions').select('status').eq('id', sessionId).single()) as any;
    expect(s.status).toBe('created');
  });

  it('comments are rejected while the session is not live', async () => {
    expectError(
      await F.client.from('live_comments').insert({ live_session_id: sessionId, author_id: F.id, body: 'Ça commence ?' }),
      'live_not_active',
    );
  });

  it('when the provider reports "live", followers get a live_started notification', async () => {
    must(await adminClient.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: 'live', p_viewer_count: 3 }));
    const s = must(await F.client.from('live_sessions').select('status, started_at, viewer_count').eq('id', sessionId).single()) as any;
    expect(s.status).toBe('live');
    expect(s.started_at).toBeTruthy();
    expect(s.viewer_count).toBe(3);

    const notes = await notificationsOf(F, 'live_started');
    expect(notes.map((n) => n.entity_id)).toEqual([sessionId]);
    expect(notes[0]!.actor_id).toBe(H.id);
    expect(await notificationsOf(N, 'live_started')).toHaveLength(0);
    // A repeated "live" webhook does not notify twice.
    must(await adminClient.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: 'live', p_viewer_count: 4 }));
    expect(await notificationsOf(F, 'live_started')).toHaveLength(1);
  });

  it('viewers can comment while live (as themselves only)', async () => {
    fComment = (
      must(
        await F.client
          .from('live_comments')
          .insert({ live_session_id: sessionId, author_id: F.id, body: 'Le prix du bazin ?' })
          .select('id')
          .single(),
      ) as any
    ).id;
    must(await N.client.from('live_comments').insert({ live_session_id: sessionId, author_id: N.id, body: 'Bonsoir' }));
    const forged = await N.client.from('live_comments').insert({ live_session_id: sessionId, author_id: F.id, body: 'Faux' });
    expect(forged.error).toBeTruthy();
    expectPermissionDenied(await anonClient().from('live_comments').insert({ live_session_id: sessionId, body: 'anon' }));
    expect(await canSee(anonClient(), 'live_comments', fComment)).toBe(true);
  });

  it('the host pins their own product, not someone else\'s; non-hosts cannot pin', async () => {
    await rpc(H.client, 'pin_live_product', { p_session_id: sessionId, p_product_id: hostProduct });
    const pins = must(
      await F.client.from('live_pins').select('product_id, unpinned_at').eq('live_session_id', sessionId),
    ) as any[];
    expect(pins).toEqual([{ product_id: hostProduct, unpinned_at: null }]);

    expectError(await H.client.rpc('pin_live_product', { p_session_id: sessionId, p_product_id: otherProduct }), 'invalid_product');
    expectError(await F.client.rpc('pin_live_product', { p_session_id: sessionId, p_product_id: hostProduct }), 'not_found');
    expectError(await O.client.rpc('pin_live_product', { p_session_id: sessionId, p_product_id: otherProduct }), 'not_found');
    expectPermissionDenied(await H.client.from('live_pins').insert({ live_session_id: sessionId, product_id: otherProduct }));
  });

  it('host mute blocks further comments and hides earlier ones from others', async () => {
    expectError(await F.client.rpc('mute_in_live', { p_session_id: sessionId, p_user_id: N.id, p_mute: true }), 'not_found');
    await rpc(H.client, 'mute_in_live', { p_session_id: sessionId, p_user_id: F.id, p_mute: true });
    expectError(
      await F.client.from('live_comments').insert({ live_session_id: sessionId, author_id: F.id, body: 'Pourquoi ?' }),
      'muted_in_live',
    );
    expect(await canSee(N.client, 'live_comments', fComment)).toBe(false);
    expect(await canSee(F.client, 'live_comments', fComment)).toBe(true); // author still sees own
    expect(must(await H.client.from('live_mutes').select('user_id').eq('live_session_id', sessionId))).toEqual([{ user_id: F.id }]);
    expectNoRowsAffected(await N.client.from('live_mutes').select('*').eq('live_session_id', sessionId));
    expectPermissionDenied(await F.client.from('live_mutes').delete().eq('live_session_id', sessionId));
  });

  it('after the provider ends the session, comments and pins are refused', async () => {
    must(await adminClient.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: 'ended' }));
    const s = must(await N.client.from('live_sessions').select('status, ended_at, viewer_count').eq('id', sessionId).single()) as any;
    expect(s.status).toBe('ended');
    expect(s.ended_at).toBeTruthy();
    expect(s.viewer_count).toBeNull();
    expectError(
      await N.client.from('live_comments').insert({ live_session_id: sessionId, author_id: N.id, body: 'Trop tard' }),
      'live_not_active',
    );
    expectError(await H.client.rpc('pin_live_product', { p_session_id: sessionId, p_product_id: hostProduct }), 'live_not_active');
    // "ended" is terminal.
    must(await adminClient.rpc('live_apply_provider_state', { p_provider_call_id: callId, p_status: 'live' }));
    const again = must(await N.client.from('live_sessions').select('status').eq('id', sessionId).single()) as any;
    expect(again.status).toBe('ended');
  });
});
