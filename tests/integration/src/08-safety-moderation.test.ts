import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminProfile,
  anonClient,
  canSee,
  createPost,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  must,
  notificationsOf,
  PNG_1X1,
  rpc,
  trySignedUrl,
  uploadImage,
  type PostFixture,
  type TestUser,
} from './helpers';

describe('SAF-01 — reports, staff moderation, appeals', () => {
  let A: TestUser; // reporter
  let B: TestUser; // content owner
  let C: TestUser; // bystander
  let M: TestUser; // moderator
  let AD: TestUser; // admin
  let post: PostFixture;
  let reportId: string;
  let actionId: string;
  let appealId: string;

  beforeAll(async () => {
    [A, B, C, M, AD] = await Promise.all([
      createUser('A'),
      createUser('B'),
      createUser('C'),
      createUser('M', { staffRole: 'moderator' }),
      createUser('AD', { staffRole: 'admin' }),
    ]);
    post = await createPost(B, 'public', 'Gagnez 1 000 000 F, envoyez 5 000 F par Wave pour débloquer');
  });

  it('A reports B\'s post; the report stores an evidence snapshot', async () => {
    reportId = await rpc<string>(A.client, 'report_content', {
      p_target_type: 'post',
      p_target_id: post.id,
      p_reason: 'scam',
      p_details: 'Arnaque classique',
    });
    const r = must(await A.client.from('reports').select('*').eq('id', reportId).single()) as any;
    expect(r).toMatchObject({ reporter_id: A.id, target_owner_id: B.id, reason: 'scam', status: 'open' });
    expect(r.evidence.body).toContain('Gagnez 1 000 000 F');
    expect(r.evidence.media[0].path).toBe(post.mediaPath);
    // Reporting twice returns the same open report.
    expect(await rpc(A.client, 'report_content', { p_target_type: 'post', p_target_id: post.id, p_reason: 'scam' })).toBe(reportId);
    // You cannot report your own content.
    expectError(
      await B.client.rpc('report_content', { p_target_type: 'post', p_target_id: post.id, p_reason: 'spam' }),
      'invalid_target',
    );
  });

  it('the reported user and bystanders cannot see the report; staff can', async () => {
    expect(await canSee(B.client, 'reports', reportId)).toBe(false);
    expect(await canSee(C.client, 'reports', reportId)).toBe(false);
    expect(await canSee(M.client, 'reports', reportId)).toBe(true);
    expectPermissionDenied(await A.client.from('reports').update({ status: 'dismissed' }).eq('id', reportId));
    expectPermissionDenied(await anonClient().from('reports').select('*'));
  });

  it('non-staff cannot use moderation tools', async () => {
    expectError(await A.client.rpc('moderate', { p_action: 'hide_content', p_target_type: 'post', p_target_id: post.id }), 'not_allowed');
    expectError(await B.client.rpc('moderate', { p_action: 'restore_content', p_target_type: 'post', p_target_id: post.id }), 'not_allowed');
    expectError(await A.client.rpc('set_report_status', { p_report_id: reportId, p_status: 'in_review' }), 'not_allowed');
    expectError(await A.client.rpc('admin_audit_log', { p_limit: 5 }), 'not_allowed');
    expectError(await A.client.rpc('admin_set_feature_flag', { p_key: 'live_streaming', p_enabled: true }), 'not_allowed');
    expectError(await M.client.rpc('admin_set_feature_flag', { p_key: 'live_streaming', p_enabled: true }), 'not_allowed');
    expectPermissionDenied(await A.client.from('moderation_actions').insert({ action: 'hide_content', target_type: 'post', target_id: post.id }));
    // The prohibited-terms list is staff-only.
    expect(must(await A.client.from('prohibited_terms').select('term'))).toHaveLength(0);
    expect((must(await M.client.from('prohibited_terms').select('term')) as any[]).length).toBeGreaterThan(0);
  });

  it('a moderator hides the post: gone for A and anonymous, owner notified, report actioned', async () => {
    await rpc(M.client, 'set_report_status', { p_report_id: reportId, p_status: 'in_review' });
    actionId = await rpc<string>(M.client, 'moderate', {
      p_action: 'hide_content',
      p_target_type: 'post',
      p_target_id: post.id,
      p_report_id: reportId,
      p_reason: 'Arnaque au paiement anticipé',
    });
    expect(await canSee(A.client, 'posts', post.id)).toBe(false);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(false);
    expect(await canSee(C.client, 'posts', post.id)).toBe(false);
    // The owner still sees it (to understand and appeal) with its moderation state.
    const own = must(await B.client.from('posts').select('moderation_status').eq('id', post.id).single()) as any;
    expect(own.moderation_status).toBe('hidden');
    expect((await adminProfile(B.id)).posts_count).toBe(0);

    const notes = await notificationsOf(B, 'moderation_action');
    expect(notes.map((n) => n.entity_id)).toContain(actionId);
    expect(notes[0]!.data.action).toBe('hide_content');
    expect(must(await B.client.from('moderation_actions').select('id').eq('id', actionId))).toHaveLength(1);
    expect(must(await C.client.from('moderation_actions').select('id').eq('id', actionId))).toHaveLength(0);

    const r = must(await A.client.from('reports').select('status, resolved_by').eq('id', reportId).single()) as any;
    expect(r).toEqual({ status: 'actioned', resolved_by: M.id });
    expect((await notificationsOf(A, 'report_resolved')).map((n) => n.entity_id)).toContain(reportId);
    const log = await rpc<any[]>(AD.client, 'admin_audit_log', { p_limit: 200 });
    expect(log.some((e) => e.action === 'moderate:hide_content' && e.entity_id === post.id)).toBe(true);
  });

  it('the owner appeals; staff reverse the decision and the post is restored', async () => {
    expectError(await A.client.rpc('submit_appeal', { p_moderation_action_id: actionId, p_body: 'Je fais appel pour B' }), 'not_found');
    appealId = await rpc<string>(B.client, 'submit_appeal', {
      p_moderation_action_id: actionId,
      p_body: "C'était une blague entre amis, merci de revoir la décision.",
    });
    expectError(
      await B.client.rpc('submit_appeal', { p_moderation_action_id: actionId, p_body: 'Deuxième appel identique' }),
      'already_appealed',
    );
    expect(await canSee(C.client, 'appeals', appealId)).toBe(false);
    expect(await canSee(M.client, 'appeals', appealId)).toBe(true);
    expectError(await B.client.rpc('resolve_appeal', { p_appeal_id: appealId, p_reverse: true, p_note: 'moi-même' }), 'not_allowed');

    await rpc(M.client, 'resolve_appeal', { p_appeal_id: appealId, p_reverse: true, p_note: 'Appel accepté' });
    expect(await canSee(A.client, 'posts', post.id)).toBe(true);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(true);
    const ap = must(await B.client.from('appeals').select('status').eq('id', appealId).single()) as any;
    expect(ap.status).toBe('reversed');
    expect((await notificationsOf(B, 'appeal_result'))[0]!.data.outcome).toBe('reversed');
    const actions = must(await B.client.from('moderation_actions').select('action').eq('target_id', post.id)) as any[];
    expect(actions.map((a) => a.action).sort()).toEqual(['hide_content', 'reverse_on_appeal']);
    expectError(await M.client.rpc('resolve_appeal', { p_appeal_id: appealId, p_reverse: false, p_note: '' }), 'invalid_transition');
  });

  it('suspension hides the account and blocks its actions; staff accounts cannot be suspended by moderators', async () => {
    const victim = await createUser('suspended');
    const vPost = await createPost(victim, 'public', 'Avant suspension');
    const action = await rpc<string>(M.client, 'moderate', {
      p_action: 'suspend_user', p_target_type: 'profile', p_target_id: victim.id, p_reason: 'Spam répété',
    });
    expect((await adminProfile(victim.id)).status).toBe('suspended');
    expect(await canSee(A.client, 'profiles', victim.id)).toBe(false);
    expect(await canSee(A.client, 'posts', vPost.id)).toBe(false);
    expectError(await victim.client.rpc('create_post', { p_body: 'Je reviens', p_visibility: 'public', p_media: [] }), 'account_suspended');
    expectError(await victim.client.rpc('get_or_create_conversation', { p_other: A.id }), 'account_suspended');
    // A suspended user may still appeal.
    expect(await rpc(victim.client, 'submit_appeal', { p_moderation_action_id: action, p_body: 'Je conteste cette suspension.' })).toBeTruthy();

    expectError(
      await M.client.rpc('moderate', { p_action: 'suspend_user', p_target_type: 'profile', p_target_id: AD.id }),
      'not_allowed',
    );
    await rpc(M.client, 'moderate', { p_action: 'unsuspend_user', p_target_type: 'profile', p_target_id: victim.id });
    expect(await canSee(A.client, 'profiles', victim.id)).toBe(true);
  });
});

describe('Evidence integrity — published media cannot be swapped after the fact', () => {
  it("the owner cannot overwrite a reported post's image (upsert / update) with other content", async () => {
    const [A, B] = await Promise.all([createUser('A'), createUser('B')]);
    const post = await createPost(B, 'public', 'Photo signalée');
    await rpc(A.client, 'report_content', { p_target_type: 'post', p_target_id: post.id, p_reason: 'nudity' });

    const swapped = new Blob([Buffer.from('ffd8ffe000104a46494600', 'hex')], { type: 'image/png' });
    const upsert = await B.client.storage
      .from('public-media')
      .upload(post.mediaPath, swapped, { upsert: true, contentType: 'image/png' });
    const update = await B.client.storage.from('public-media').update(post.mediaPath, swapped, { contentType: 'image/png' });
    expect(upsert.error, 'upsert over published media must be refused').toBeTruthy();
    expect(update.error, 'update of published media must be refused').toBeTruthy();

    const { data } = anonClient().storage.from('public-media').getPublicUrl(post.mediaPath);
    const served = Buffer.from(await (await fetch(data.publicUrl)).arrayBuffer());
    expect(served.equals(PNG_1X1)).toBe(true);
  });
});

describe('SAF-02 — verified badge is granted by an admin only', () => {
  let B: TestUser;
  let M: TestUser;
  let AD: TestUser;
  let requestId: string;

  beforeAll(async () => {
    [B, M, AD] = await Promise.all([
      createUser('merchant'),
      createUser('M', { staffRole: 'moderator' }),
      createUser('AD', { staffRole: 'admin' }),
    ]);
  });

  it('a merchant files a verification request but cannot pre-approve it', async () => {
    expectPermissionDenied(
      await B.client.from('verification_requests').insert({
        user_id: B.id, business_name: 'Boutique Ndèye', business_type: 'boutique', status: 'approved',
      }),
    );
    const vr = must(
      await B.client
        .from('verification_requests')
        .insert({ user_id: B.id, business_name: 'Boutique Ndèye', business_type: 'boutique', details: 'Marché Sandaga' })
        .select('id, status')
        .single(),
    ) as any;
    requestId = vr.id;
    expect(vr.status).toBe('pending');
    expectPermissionDenied(await B.client.from('verification_requests').update({ status: 'approved' }).eq('id', requestId));
  });

  it('a moderator cannot grant verification (admin only)', async () => {
    expectError(
      await M.client.rpc('moderate', { p_action: 'grant_verification', p_target_type: 'profile', p_target_id: B.id }),
      'not_allowed',
    );
    expectError(
      await M.client.rpc('review_verification_request', { p_request_id: requestId, p_approve: true, p_note: 'ok' }),
      'not_allowed',
    );
    expectError(
      await B.client.rpc('review_verification_request', { p_request_id: requestId, p_approve: true, p_note: 'moi' }),
      'not_allowed',
    );
    expect((await adminProfile(B.id)).verification_level).toBe('none');
  });

  it('an admin approves the request → verification_level is set and the merchant is notified', async () => {
    await rpc(AD.client, 'review_verification_request', { p_request_id: requestId, p_approve: true, p_note: 'Documents vérifiés' });
    const p = await adminProfile(B.id);
    expect(p.verification_level).toBe('merchant_verified');
    expect(p.is_merchant).toBe(true);
    expect((await notificationsOf(B, 'verification_result'))[0]!.data.approved).toBe(true);
    expectError(
      await AD.client.rpc('review_verification_request', { p_request_id: requestId, p_approve: false, p_note: '' }),
      'invalid_transition',
    );
  });
});

describe('Reported private message: evidence without blanket DM access', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let M: TestUser;
  let cid: string;
  let textMsg: string;
  let imageMsg: string;
  let imagePath: string;

  beforeAll(async () => {
    [A, B, C, M] = await Promise.all([
      createUser('A'),
      createUser('B'),
      createUser('C'),
      createUser('M', { staffRole: 'moderator' }),
    ]);
    cid = await rpc<string>(A.client, 'get_or_create_conversation', { p_other: B.id });
    must(await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body: 'Bonjour, le sac est dispo ?' }));
    textMsg = (
      must(
        await B.client
          .from('messages')
          .insert({ conversation_id: cid, sender_id: B.id, body: 'Envoie 10 000 F par Wave avant, sinon rien' })
          .select('id')
          .single(),
      ) as any
    ).id;
    imagePath = await uploadImage(B, 'private-media');
    imageMsg = (
      must(
        await B.client
          .from('messages')
          .insert({ conversation_id: cid, sender_id: B.id, kind: 'image', attachment_path: imagePath })
          .select('id')
          .single(),
      ) as any
    ).id;
  });

  it('a non-member cannot report (or read) the message', async () => {
    expectError(
      await C.client.rpc('report_content', { p_target_type: 'message', p_target_id: textMsg, p_reason: 'scam' }),
      'not_found',
    );
    expect(await trySignedUrl(C.client, 'private-media', imagePath)).toBeNull();
  });

  it('staff read the copied evidence but NOT the conversation itself', async () => {
    const r1 = await rpc<string>(A.client, 'report_content', { p_target_type: 'message', p_target_id: textMsg, p_reason: 'scam' });
    const r2 = await rpc<string>(A.client, 'report_content', { p_target_type: 'message', p_target_id: imageMsg, p_reason: 'scam' });

    const reports = must(await M.client.from('reports').select('id, evidence').in('id', [r1, r2])) as any[];
    const byId = Object.fromEntries(reports.map((r) => [r.id, r.evidence]));
    expect(byId[r1].body).toBe('Envoie 10 000 F par Wave avant, sinon rien');
    expect(byId[r1].conversation_id).toBe(cid);
    expect(byId[r2].attachment_path).toBe(imagePath);

    expect(must(await M.client.from('messages').select('id').eq('conversation_id', cid))).toHaveLength(0);
    expect(must(await M.client.from('messages').select('id').eq('id', textMsg))).toHaveLength(0);
    expect(must(await M.client.from('conversations').select('id').eq('id', cid))).toHaveLength(0);
    expect(must(await M.client.from('conversation_members').select('user_id').eq('conversation_id', cid))).toHaveLength(0);
    expect((await rpc<any[]>(M.client, 'my_conversations')).map((c) => c.conversation_id)).not.toContain(cid);

    // The reported attachment itself is readable by staff for the review.
    expect(await trySignedUrl(M.client, 'private-media', imagePath)).toBeTruthy();
  });

  it('removing a reported message erases it for both members', async () => {
    await rpc(M.client, 'moderate', { p_action: 'remove_content', p_target_type: 'message', p_target_id: textMsg });
    const seen = must(await A.client.from('messages').select('body, deleted_at').eq('id', textMsg).single()) as any;
    expect(seen.body).toBe('');
    expect(seen.deleted_at).toBeTruthy();
    expectNoRowsAffected(await M.client.from('messages').select('id').eq('id', textMsg));
  });
});
