/**
 * P2 — Studio destinations, Reels and the « Le garder en Reel ? » offer.
 * Reels are permanent public videos; `in_feed` / `in_reels` say where a publication shows; the
 * ranking is freshness + followed + nearby + has a product; a well-watched video status that
 * expires keeps its file 48 h and notifies its owner once.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, anonClient, createListing, createStory, createUser, expectError, expectPermissionDenied, follow, mediaJson, must, notificationsOf, rpc, token, uploadImage, type Bucket, type TestUser } from './helpers';

const MP4_BYTES = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');

async function uploadVideo(user: TestUser, bucket: Bucket = 'public-media', folder = 'videos'): Promise<string> {
  const path = `${user.id}/${folder}/${token(12)}.mp4`;
  const { error } = await user.client.storage.from(bucket).upload(path, new Blob([MP4_BYTES], { type: 'video/mp4' }), { contentType: 'video/mp4' });
  if (error) throw new Error(`video upload failed: ${error.message}`);
  return path;
}
const videoMedia = (path: string) => ({ kind: 'video', path, width: 720, height: 1280, duration_ms: 12000 });

async function videoPost(user: TestUser, productIds: string[] = [], visibility: 'public' | 'followers' = 'public'): Promise<string> {
  const bucket: Bucket = visibility === 'public' ? 'public-media' : 'private-media';
  return rpc<string>(user.client, 'create_post', {
    p_body: `Reel ${token(5)}`,
    p_visibility: visibility,
    p_media: [videoMedia(await uploadVideo(user, bucket))],
    p_product_ids: productIds,
  });
}

describe('P2 — Reel destinations', () => {
  let A: TestUser; // author
  let B: TestUser; // viewer who follows A
  let C: TestUser; // stranger

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('RA', { onboarded: true }), createUser('RB', { onboarded: true }), createUser('RC', { onboarded: true })]);
    await follow(B, A);
  });

  it('a public video can be shown in Reels only, and is then out of the feed flag', async () => {
    const id = await videoPost(A);
    await rpc(A.client, 'set_post_surfaces', { p_post_id: id, p_in_feed: false, p_in_reels: true });
    const row = must(await adminClient.from('posts').select('in_feed, in_reels').eq('id', id).single()) as any;
    expect(row).toEqual({ in_feed: false, in_reels: true });
  });

  it('only the author chooses, and at least one destination remains', async () => {
    const id = await videoPost(A);
    expectError(await C.client.rpc('set_post_surfaces', { p_post_id: id, p_in_feed: true, p_in_reels: true }), 'post_not_found');
    expectError(await A.client.rpc('set_post_surfaces', { p_post_id: id, p_in_feed: false, p_in_reels: false }), 'no_destination');
  });

  it('a Reel must be a public video: photos and restricted audiences are refused', async () => {
    const photo = await rpc<string>(A.client, 'create_post', { p_body: 'Photo', p_visibility: 'public', p_media: [{ kind: 'image', path: await uploadImage(A), width: 1, height: 1 }], p_product_ids: [] });
    expectError(await A.client.rpc('set_post_surfaces', { p_post_id: photo, p_in_feed: true, p_in_reels: true }), 'not_a_reel');
    const restricted = await videoPost(A, [], 'followers');
    expectError(await A.client.rpc('set_post_surfaces', { p_post_id: restricted, p_in_feed: true, p_in_reels: true }), 'not_a_reel');
  });

  it('the surface flags cannot be forged with a direct update', async () => {
    const id = await videoPost(A);
    expectPermissionDenied(await A.client.from('posts').update({ in_reels: true }).eq('id', id));
    expectPermissionDenied(await A.client.from('posts').update({ in_feed: false }).eq('id', id));
  });

  it('get_reels lists Reels only, a followed author ahead of a stranger, and p_start pins one first', async () => {
    const mine = await videoPost(A);
    await rpc(A.client, 'set_post_surfaces', { p_post_id: mine, p_in_feed: true, p_in_reels: true });
    const notReel = await videoPost(A, [], 'followers');
    const strangerReel = await videoPost(C);
    await rpc(C.client, 'set_post_surfaces', { p_post_id: strangerReel, p_in_feed: true, p_in_reels: true });
    const list = await rpc<{ post_id: string; reason: string }[]>(B.client, 'get_reels', { p_limit: 20 });
    const ids = list.map((r) => r.post_id);
    expect(ids).toContain(mine);
    expect(ids).toContain(strangerReel);
    expect(ids).not.toContain(notReel);
    expect(ids.indexOf(mine)).toBeLessThan(ids.indexOf(strangerReel));
    expect(list.find((r) => r.post_id === mine)?.reason).toBe('followed');
    const pinned = await rpc<{ post_id: string }[]>(B.client, 'get_reels', { p_limit: 5, p_start: strangerReel });
    expect(pinned[0]?.post_id).toBe(strangerReel);
  });

  it('a Reel with a tagged article outranks an otherwise equal one without', async () => {
    const D = await createUser('RD', { onboarded: true });
    const E = await createUser('RE', { onboarded: true });
    const product = await createListing(D);
    const withProduct = await videoPost(D, [product]);
    await rpc(D.client, 'set_post_surfaces', { p_post_id: withProduct, p_in_feed: true, p_in_reels: true });
    const without = await videoPost(E);
    await rpc(E.client, 'set_post_surfaces', { p_post_id: without, p_in_feed: true, p_in_reels: true });
    const list = await rpc<{ post_id: string; reason: string }[]>(C.client, 'get_reels', { p_limit: 20 });
    expect(list.find((r) => r.post_id === withProduct)?.reason).toBe('product');
    expect(list.findIndex((r) => r.post_id === withProduct)).toBeLessThan(list.findIndex((r) => r.post_id === without));
  });

  it('a blocked author does not appear in Reels', async () => {
    const X = await createUser('RX', { onboarded: true });
    const reel = await videoPost(X);
    await rpc(X.client, 'set_post_surfaces', { p_post_id: reel, p_in_feed: true, p_in_reels: true });
    must(await C.client.from('blocks').insert({ blocker_id: C.id, blocked_id: X.id }));
    const ids = (await rpc<{ post_id: string }[]>(C.client, 'get_reels', { p_limit: 20 })).map((r) => r.post_id);
    expect(ids).not.toContain(reel);
  });
});

describe('P2 — Reels are for signed-in members', () => {
  it('anonymous visitors cannot call get_reels, set_post_surfaces or purge_expired_stories', async () => {
    const anon = anonClient();
    expect((await anon.rpc('get_reels', { p_limit: 5 })).error?.code).toBe('42501');
    expect((await anon.rpc('set_post_surfaces', { p_post_id: '00000000-0000-0000-0000-000000000000', p_in_feed: true, p_in_reels: true })).error?.code).toBe('42501');
    expect((await anon.rpc('purge_expired_stories')).error?.code).toBe('42501');
  });
});

describe('P2 — « Le garder en Reel ? »', () => {
  let S: TestUser;
  let V1: TestUser;
  let V2: TestUser;

  async function videoStory(owner: TestUser): Promise<{ id: string; path: string }> {
    const path = await uploadVideo(owner, 'private-media', 'stories');
    const id = await rpc<string>(owner.client, 'create_story', { p_media_kind: 'video', p_path: path, p_poster_path: null, p_width: 720, p_height: 1280, p_duration_ms: 9000, p_caption: 'Arrivage', p_audience: 'public', p_product_id: null });
    return { id, path };
  }
  const expire = async (id: string) => must(await adminClient.from('stories').update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq('id', id));

  beforeAll(async () => {
    [S, V1, V2] = await Promise.all([createUser('KS', { onboarded: true }), createUser('KV1', { onboarded: true }), createUser('KV2', { onboarded: true })]);
    // Threshold 2 for the test (the shipped value is 100, read from app_config).
    must(await adminClient.from('app_config').update({ value: 2 }).eq('key', 'reel_keep_min_views'));
  });

  it('app_config is invisible to members', async () => {
    const res = await S.client.from('app_config').select('*');
    expect(res.data ?? []).toHaveLength(0);
  });

  it('a video status with enough views notifies its owner once and keeps its file; a quiet one is purged', async () => {
    const hot = await videoStory(S);
    const quiet = await videoStory(S);
    for (const v of [V1, V2]) must(await v.client.from('story_views').insert({ story_id: hot.id, viewer_id: v.id }));
    must(await V1.client.from('story_views').insert({ story_id: quiet.id, viewer_id: V1.id }));
    await expire(hot.id);
    await expire(quiet.id);
    const purged1 = must(await adminClient.rpc('purge_expired_stories')) as { storage_path: string }[];
    expect(purged1.map((r) => r.storage_path)).toContain(quiet.path);
    expect(purged1.map((r) => r.storage_path)).not.toContain(hot.path);
    const notes = await notificationsOf(S, 'reel_candidate');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ entity_type: 'story', entity_id: hot.id });
    expect((notes[0] as any).data.views).toBe(2);
    // A second run neither duplicates the notification nor purges the held file.
    const purged2 = must(await adminClient.rpc('purge_expired_stories')) as { storage_path: string }[];
    expect(purged2.map((r) => r.storage_path)).not.toContain(hot.path);
    expect(await notificationsOf(S, 'reel_candidate')).toHaveLength(1);
    // After the 48 h window the file is reclaimed like any expired status.
    must(await adminClient.from('notifications').update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString() }).eq('entity_id', hot.id));
    const purged3 = must(await adminClient.rpc('purge_expired_stories')) as { storage_path: string }[];
    expect(purged3.map((r) => r.storage_path)).toContain(hot.path);
  });

  it('photo statuses never trigger the offer, whatever their views', async () => {
    const photo = await createStory(S, 'public');
    for (const v of [V1, V2]) must(await v.client.from('story_views').insert({ story_id: photo.id, viewer_id: v.id }));
    await expire(photo.id);
    await adminClient.rpc('purge_expired_stories');
    expect((await notificationsOf(S, 'reel_candidate')).some((n) => n.entity_id === photo.id)).toBe(false);
  });

  it('the owner can copy the held video to the public bucket and publish it as a Reel', async () => {
    const hot = await videoStory(S);
    for (const v of [V1, V2]) must(await v.client.from('story_views').insert({ story_id: hot.id, viewer_id: v.id }));
    await expire(hot.id);
    await adminClient.rpc('purge_expired_stories');
    const copy = await S.client.storage.from('private-media').copy(hot.path, hot.path, { destinationBucket: 'public-media' });
    expect(copy.error).toBeNull();
    const id = await rpc<string>(S.client, 'create_post', { p_body: 'Arrivage', p_visibility: 'public', p_media: [videoMedia(hot.path)], p_product_ids: [] });
    await rpc(S.client, 'set_post_surfaces', { p_post_id: id, p_in_feed: false, p_in_reels: true });
    const ids = (await rpc<{ post_id: string }[]>(V1.client, 'get_reels', { p_limit: 20 })).map((r) => r.post_id);
    expect(ids).toContain(id);
  });
});

describe('P2 — status rail order', () => {
  it('yours first, then unseen, then followed, then the rest', async () => {
    const [Me, F, O, Seen] = await Promise.all([createUser('OM', { onboarded: true }), createUser('OF', { onboarded: true }), createUser('OO', { onboarded: true }), createUser('OS', { onboarded: true })]);
    await follow(Me, F);
    await follow(Me, Seen);
    const mine = await createStory(Me, 'public');
    const other = await createStory(O, 'public');
    const followed = await createStory(F, 'public');
    const seen = await createStory(Seen, 'public');
    must(await Me.client.from('story_views').insert({ story_id: seen.id, viewer_id: Me.id }));
    const rail = (await rpc<{ author_id: string }[]>(Me.client, 'get_story_rail')).map((r) => r.author_id);
    const pos = (u: TestUser) => rail.indexOf(u.id);
    expect(pos(Me)).toBe(0);
    expect(pos(F)).toBeLessThan(pos(O)); // unseen: followed before a stranger
    expect(pos(O)).toBeLessThan(pos(Seen)); // unseen before seen, even when the seen one is followed
    void mine; void other; void followed;
  });
});
