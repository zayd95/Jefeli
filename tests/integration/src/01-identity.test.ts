import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminProfile,
  anonClient,
  createPost,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  follow,
  hasPsql,
  must,
  psql,
  rpc,
  type TestUser,
} from './helpers';

describe('ID-01 — independent accounts, private data stays private', () => {
  let A: TestUser;
  let B: TestUser;

  beforeAll(async () => {
    [A, B] = await Promise.all([createUser('A'), createUser('B')]);
  });

  it('A and B are independent: each gets its own neutral profile and settings row', async () => {
    expect(A.id).not.toBe(B.id);
    const pa = must(await A.client.from('profiles').select('*').eq('id', A.id).single()) as any;
    const pb = must(await A.client.from('profiles').select('*').eq('id', B.id).single()) as any;
    expect(pa.handle).not.toBe(pb.handle);
    // The neutral handle is never derived from the e-mail address.
    expect(pa.handle).toMatch(/^membre[0-9a-f]{8}$/);
    expect(pa.handle).not.toContain(A.email.split('@')[0]);
    expect(pa.verification_level).toBe('none');
    expect(pa.status).toBe('active');

    const settings = must(await A.client.from('account_settings').select('*')) as any[];
    expect(settings).toHaveLength(1);
    expect(settings[0].user_id).toBe(A.id);
  });

  it('profiles expose no e-mail or phone (not even through an explicit column select)', async () => {
    const pb = must(await A.client.from('profiles').select('*').eq('id', B.id).single()) as Record<string, unknown>;
    for (const key of Object.keys(pb)) expect(key).not.toMatch(/mail|phone/i);
    expect(JSON.stringify(pb)).not.toContain(B.email);

    for (const client of [A.client, anonClient()]) {
      const email = await client.from('profiles').select('email').eq('id', B.id);
      expect(email.error).toBeTruthy();
      const phone = await client.from('profiles').select('phone').eq('id', B.id);
      expect(phone.error).toBeTruthy();
    }
  });

  it("A cannot update B's profile", async () => {
    const res = await A.client.from('profiles').update({ display_name: 'Piraté', bio: 'hack' }).eq('id', B.id).select();
    expectNoRowsAffected(res);
    const truth = await adminProfile(B.id);
    expect(truth.display_name).not.toBe('Piraté');
    expect(truth.bio).not.toBe('hack');
  });

  it('A can edit the allowed columns of their own profile', async () => {
    const rows = must(
      await A.client
        .from('profiles')
        .update({ display_name: 'Aïssatou Test', bio: 'Vendeuse à Dakar', city: 'Dakar' })
        .eq('id', A.id)
        .select('display_name, city'),
    ) as any[];
    expect(rows).toEqual([{ display_name: 'Aïssatou Test', city: 'Dakar' }]);
  });

  const forbidden: [string, unknown][] = [
    ['verification_level', 'merchant_verified'],
    ['status', 'active'],
    ['followers_count', 100000],
    ['following_count', 5],
    ['friends_count', 5],
    ['posts_count', 5],
    ['products_count', 5],
    ['rating_sum', 500],
    ['rating_count', 100],
    ['is_demo', true],
  ];
  it.each(forbidden)('A cannot set their own %s (column grant)', async (column, value) => {
    const before = await adminProfile(A.id);
    const res = await A.client.from('profiles').update({ [column]: value }).eq('id', A.id).select();
    expectPermissionDenied(res);
    const after = await adminProfile(A.id);
    expect(after[column]).toEqual(before[column]);
  });

  it('a reserved handle cannot be claimed', async () => {
    expectError(await A.client.from('profiles').update({ handle: 'admin' }).eq('id', A.id), 'handle_reserved');
    expectError(await A.client.from('profiles').update({ handle: 'Jefeli' }).eq('id', A.id), 'handle_reserved');
  });

  it('clients cannot create profiles or self-assign staff roles', async () => {
    expectPermissionDenied(
      await A.client.from('profiles').insert({ id: crypto.randomUUID(), handle: 'fauxcompte', display_name: 'Faux' }),
    );
    expectPermissionDenied(await A.client.from('staff_roles').insert({ user_id: A.id, role: 'admin' }));
    expect(await rpc(A.client, 'my_staff_role')).toBeNull();
  });

  it('anonymous visitors cannot read account_settings at all', async () => {
    const res = await anonClient().from('account_settings').select('*');
    expectPermissionDenied(res);
  });

  it("A can neither read nor change B's settings", async () => {
    expectNoRowsAffected(await A.client.from('account_settings').select('*').eq('user_id', B.id));
    expectNoRowsAffected(
      await A.client.from('account_settings').update({ allow_messages_from: 'friends' }).eq('user_id', B.id).select(),
    );
    // Embedding settings through the (public) profile does not leak them either.
    const embedded = must(
      await A.client.from('profiles').select('id, account_settings(*)').eq('id', B.id).single(),
    ) as any;
    expect(embedded.account_settings ?? null).toBeNull();
    const truth = must(await A.client.from('account_settings').select('user_id')) as any[];
    expect(truth.map((r) => r.user_id)).toEqual([A.id]);
    // B's value is unchanged (ground truth).
    const bSettings = must(await B.client.from('account_settings').select('allow_messages_from').single()) as any;
    expect(bSettings.allow_messages_from).toBe('everyone');
  });

  it('A can update their own settings, but not protected columns', async () => {
    must(await A.client.from('account_settings').update({ locale: 'wo', notify_live: false }).eq('user_id', A.id));
    const s = must(await A.client.from('account_settings').select('locale, notify_live').single()) as any;
    expect(s).toEqual({ locale: 'wo', notify_live: false });
    expectPermissionDenied(await A.client.from('account_settings').update({ user_id: B.id }).eq('user_id', A.id));
  });
});

describe('export_my_data & anonymous access to RPCs', () => {
  let A: TestUser;
  let B: TestUser;

  beforeAll(async () => {
    [A, B] = await Promise.all([createUser('exportA'), createUser('exportB')]);
    await follow(A, B);
    await follow(B, A);
  });

  it("export_my_data returns the caller's own data only", async () => {
    const postA = await createPost(A, 'public', 'Publication de A');
    const postB = await createPost(B, 'public', 'Publication de B');
    const dump = await rpc<Record<string, any>>(A.client, 'export_my_data');

    expect(dump.account.email).toBe(A.email);
    expect(dump.profile.id).toBe(A.id);
    expect(dump.settings.user_id).toBe(A.id);
    const postIds = (dump.posts as any[]).map((p) => p.id);
    expect(postIds).toContain(postA.id);
    expect(postIds).not.toContain(postB.id);
    for (const p of dump.posts as any[]) expect(p.author_id).toBe(A.id);
    for (const m of dump.messages_sent as any[]) expect(m.sender_id).toBe(A.id);
    for (const f of dump.follows as any[]) expect([f.follower_id, f.followee_id]).toContain(A.id);
    expect(JSON.stringify(dump)).not.toContain(B.email);

    const dumpB = await rpc<Record<string, any>>(B.client, 'export_my_data');
    expect(dumpB.account.email).toBe(B.email);
    expect(JSON.stringify(dumpB)).not.toContain(A.email);
  });

  it('anonymous callers cannot execute mutation / private RPCs', async () => {
    const anon = anonClient();
    const u = crypto.randomUUID();
    const calls: [string, Record<string, unknown>][] = [
      ['create_post', { p_body: 'x', p_visibility: 'public', p_media: [], p_product_ids: [] }],
      [
        'create_listing',
        {
          p_title: 'abc', p_description: '', p_price_xof: 1, p_category_slug: 'autres', p_condition: 'new',
          p_listing_mode: 'sale', p_quantity: 1, p_city: null, p_neighborhood: null, p_delivery_options: ['pickup'],
          p_delivery_notes: '', p_media: [],
        },
      ],
      [
        'create_story',
        {
          p_media_kind: 'image', p_path: 'x', p_poster_path: null, p_width: 1, p_height: 1, p_duration_ms: null,
          p_caption: '', p_audience: 'public',
        },
      ],
      ['set_listing_media', { p_product_id: u, p_media: [] }],
      ['make_offer', { p_product_id: u, p_kind: 'price', p_amount_xof: 1 }],
      ['counter_offer', { p_offer_id: u, p_amount_xof: 1 }],
      ['respond_offer', { p_offer_id: u, p_accept: true }],
      ['withdraw_offer', { p_offer_id: u }],
      ['confirm_agreement_completed', { p_agreement_id: u }],
      ['close_agreement', { p_agreement_id: u, p_outcome: 'canceled', p_reason: '' }],
      ['leave_review', { p_agreement_id: u, p_rating: 5, p_body: '' }],
      ['get_or_create_conversation', { p_other: u }],
      ['message_about_product', { p_product_id: u, p_body: 'x' }],
      ['reply_to_story', { p_story_id: u, p_body: 'x' }],
      ['my_conversations', {}],
      ['unread_messages_count', {}],
      ['report_content', { p_target_type: 'post', p_target_id: u, p_reason: 'spam' }],
      ['moderate', { p_action: 'hide_content', p_target_type: 'post', p_target_id: u }],
      ['set_report_status', { p_report_id: u, p_status: 'in_review' }],
      ['review_verification_request', { p_request_id: u, p_approve: true, p_note: '' }],
      ['submit_appeal', { p_moderation_action_id: u, p_body: 'xxxxxxxxxxxx' }],
      ['resolve_appeal', { p_appeal_id: u, p_reverse: true, p_note: '' }],
      ['admin_set_feature_flag', { p_key: 'live_streaming', p_enabled: true }],
      ['admin_audit_log', { p_limit: 1 }],
      ['send_friend_request', { p_target: u }],
      ['respond_friend_request', { p_request_id: u, p_accept: true }],
      ['cancel_friend_request', { p_request_id: u }],
      ['remove_friend', { p_other: u }],
      ['delete_comment', { p_comment_id: u }],
      ['pin_live_product', { p_session_id: u, p_product_id: u }],
      ['unpin_live_product', { p_session_id: u }],
      ['mute_in_live', { p_session_id: u, p_user_id: u, p_mute: true }],
      ['hide_live_comment', { p_comment_id: u }],
      ['live_apply_provider_state', { p_provider_call_id: 'x', p_status: 'live' }],
      ['purge_expired_stories', {}],
      ['expire_stale_offers', {}],
      ['export_my_data', {}],
      ['mark_all_notifications_read', {}],
      ['register_push_token', { p_token: 'ExponentPushToken[xxxxxxxx]', p_platform: 'ios' }],
    ];
    const notDenied: string[] = [];
    for (const [fn, args] of calls) {
      const res = await anon.rpc(fn, args);
      if (!(res.error && res.error.code === '42501')) {
        notDenied.push(`${fn}: ${res.error ? `${res.error.code} ${res.error.message}` : 'succeeded'}`);
      }
    }
    expect(notDenied).toEqual([]);
  });

  it('server-only RPCs are not executable by signed-in users either', async () => {
    for (const [fn, args] of [
      ['live_apply_provider_state', { p_provider_call_id: 'x', p_status: 'live' }],
      ['purge_expired_stories', {}],
      ['expire_stale_offers', {}],
    ] as const) {
      expectPermissionDenied(await A.client.rpc(fn, args));
    }
  });

  it('the private schema is not reachable through the Data API', async () => {
    const res = await A.client.schema('private').rpc('set_content_state', {
      p_type: 'post',
      p_id: crypto.randomUUID(),
      p_state: 'hidden',
    });
    expect(res.error).toBeTruthy();
    const res2 = await anonClient().schema('private').from('rate_limits').select('*');
    expect(res2.error).toBeTruthy();
  });

  it.skipIf(!hasPsql())(
    'defense in depth: internal private.* helpers are not executable by anon/authenticated',
    () => {
      // These helpers mutate data or leak data for an arbitrary user id. They are only meant to
      // be called from SECURITY DEFINER code, so the API roles must not hold EXECUTE on them.
      const internal = [
        'private.notify(uuid,uuid,text,text,uuid,jsonb)',
        'private.set_content_state(text,uuid,public.moderation_state)',
        'private.open_conversation(uuid,uuid)',
        'private.report_target_info(text,uuid,uuid)',
        'private.audit(text,text,text,jsonb)',
        'private.enforce_rate_limit(text,integer,interval)',
        'private.refresh_rating(uuid)',
        'private.prune_rate_limits()',
        'private.lock_pending_offer_for_recipient(uuid,uuid)',
        'private.product_snapshot(uuid)',
      ];
      const rows = psql(
        `select f || '|' || has_function_privilege('anon', f, 'execute') || '|' || has_function_privilege('authenticated', f, 'execute')
         from unnest(array[${internal.map((f) => `'${f}'`).join(',')}]) f`,
      )
        .split('\n')
        .filter(Boolean);
      const exposed = rows
        .map((r) => r.split('|'))
        .filter(([, anon, authd]) => anon === 'true' || authd === 'true')
        .map(([fn, anon, authd]) => `${fn} anon=${anon} authenticated=${authd}`);
      expect(exposed, 'private helpers executable by API roles').toEqual([]);
    },
  );
});
