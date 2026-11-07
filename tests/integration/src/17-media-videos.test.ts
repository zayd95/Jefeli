/**
 * W1.1 media-first commerce: three-minute videos in publications, listings and statuses, enforced
 * by the database; declared media must match the stored file; per-member upload quota; orphaned
 * files listed for cleanup without ever touching a file that is still referenced; expired status
 * files unreadable.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env';
import { adminClient, anonClient, createUser, expectError, follow, hasPsql, listingArgs, psql, rpc, token, uploadImage, type Bucket, type TestUser } from './helpers';

// The storage server records the declared content type; the bytes do not matter for these rules.
const MP4_BYTES = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');

async function uploadVideo(user: TestUser, bucket: Bucket = 'public-media'): Promise<string> {
  const path = `${user.id}/videos/${token(12)}.mp4`;
  const { error } = await user.client.storage.from(bucket).upload(path, new Blob([MP4_BYTES], { type: 'video/mp4' }), { contentType: 'video/mp4' });
  if (error) throw new Error(`video upload failed: ${error.message}`);
  return path;
}

const video = (path: string, duration_ms: number | null, extra: Record<string, unknown> = {}) => ({ kind: 'video', path, width: 720, height: 1280, duration_ms, ...extra });
const image = (path: string) => ({ kind: 'image', path, width: 1, height: 1 });
const postArgs = (media: unknown[]) => ({ p_body: `Vidéo ${token(5)}`, p_visibility: 'public', p_media: media, p_product_ids: [] });
const storyArgs = (path: string, kind: 'image' | 'video', duration: number | null, poster: string | null = null) => ({
  p_media_kind: kind,
  p_path: path,
  p_poster_path: poster,
  p_width: 720,
  p_height: 1280,
  p_duration_ms: duration,
  p_caption: 'Arrivage',
  p_audience: 'public',
  p_product_id: null,
});

describe('three-minute videos, enforced by the database', () => {
  let S: TestUser;
  let O: TestUser;

  beforeAll(async () => {
    S = await createUser('vid_seller', { onboarded: true });
    O = await createUser('vid_other', { onboarded: true });
  });

  it('a publication takes a video of exactly 180 s with its poster, and refuses 180.001 s', async () => {
    const poster = await uploadImage(S, 'public-media');
    expect(await rpc<string>(S.client, 'create_post', postArgs([video(await uploadVideo(S), 180000, { poster_path: poster })]))).toBeTruthy();
    expectError(await S.client.rpc('create_post', postArgs([video(await uploadVideo(S), 180001)])), 'video_too_long');
  });

  it('a video must declare its duration', async () => {
    expectError(await S.client.rpc('create_post', postArgs([video(await uploadVideo(S), null)])), 'video_duration_required');
  });

  it('a listing takes a 3-minute promotional video next to its photos, not a longer one', async () => {
    const photo = await uploadImage(S, 'public-media');
    const args = listingArgs(photo);
    expect(await rpc<string>(S.client, 'create_listing', { ...args, p_media: [image(photo), video(await uploadVideo(S), 180000)] })).toBeTruthy();
    expectError(
      await S.client.rpc('create_listing', { ...listingArgs(photo), p_media: [image(photo), video(await uploadVideo(S), 200000)] }),
      'video_too_long',
    );
  });

  it('a status video can last 3 minutes (the old 60 s cap is gone), not more', async () => {
    expect(await rpc<string>(S.client, 'create_story', storyArgs(await uploadVideo(S, 'private-media'), 'video', 120000))).toBeTruthy();
    expect(await rpc<string>(S.client, 'create_story', storyArgs(await uploadVideo(S, 'private-media'), 'video', 180000))).toBeTruthy();
    expectError(await S.client.rpc('create_story', storyArgs(await uploadVideo(S, 'private-media'), 'video', 180500)), 'video_too_long');
  });

  it('the declared kind must match the stored file, and a poster must be an image', async () => {
    const png = await uploadImage(S, 'public-media');
    const mp4 = await uploadVideo(S);
    expectError(await S.client.rpc('create_post', postArgs([video(png, 30000)])), 'invalid_media');
    expectError(await S.client.rpc('create_post', postArgs([image(mp4)])), 'invalid_media');
    expectError(await S.client.rpc('create_post', postArgs([video(mp4, 30000, { poster_path: await uploadVideo(S) })])), 'invalid_media');
    expectError(await S.client.rpc('create_story', storyArgs(await uploadImage(S, 'private-media'), 'video', 30000)), 'invalid_media');
  });

  it('nobody can publish someone else’s video', async () => {
    const theirs = await uploadVideo(S);
    expectError(await O.client.rpc('create_post', postArgs([video(theirs, 30000)])), 'media_not_found');
  });
});

describe('upload quota per member', () => {
  it('stops new uploads after 300 files in 24 h', async () => {
    if (!hasPsql()) return;
    const Q = await createUser('quota_count');
    psql(`insert into storage.objects (bucket_id, name, owner_id, metadata)
          select 'public-media', '${Q.id}/quota/' || g || '.jpg', '${Q.id}', '{"size": 1, "mimetype": "image/jpeg"}'
          from generate_series(1, 300) g`);
    await expect(uploadImage(Q, 'public-media')).rejects.toThrow(/row-level security/i);
  });

  it('stops new uploads once 2 GB are stored', async () => {
    if (!hasPsql()) return;
    const Q = await createUser('quota_bytes');
    psql(`insert into storage.objects (bucket_id, name, owner_id, metadata, created_at)
          values ('public-media', '${Q.id}/quota/big.mp4', '${Q.id}', '{"size": 2147483648, "mimetype": "video/mp4"}', now() - interval '3 days')`);
    await expect(uploadImage(Q, 'public-media')).rejects.toThrow(/row-level security/i);
  });

  it('a member under the quota uploads normally', async () => {
    const Q = await createUser('quota_ok');
    expect(await uploadImage(Q, 'public-media')).toContain(Q.id);
  });
});

describe('orphaned files', () => {
  let S: TestUser;
  const age = (path: string) => psql(`update storage.objects set created_at = now() - interval '3 days' where name = '${path}'`);
  const orphans = async () => {
    const { data, error } = await adminClient.rpc('list_orphaned_media', { p_limit: 1000 });
    if (error) throw error;
    return new Set(((data ?? []) as { name: string }[]).map((r) => r.name));
  };

  beforeAll(async () => {
    S = await createUser('orphan_seller', { onboarded: true });
  });

  it('lists an abandoned upload older than 48 h, but not a recent one', async () => {
    if (!hasPsql()) return;
    const old = await uploadImage(S, 'public-media');
    const recent = await uploadImage(S, 'public-media');
    age(old);
    const list = await orphans();
    expect(list.has(old)).toBe(true);
    expect(list.has(recent)).toBe(false);
  });

  it('never lists a file still used by a publication, a listing or a live status', async () => {
    if (!hasPsql()) return;
    const postFile = await uploadVideo(S);
    await rpc(S.client, 'create_post', postArgs([video(postFile, 60000)]));
    const listingFile = await uploadImage(S, 'public-media');
    await rpc(S.client, 'create_listing', listingArgs(listingFile));
    const storyFile = await uploadVideo(S, 'private-media');
    await rpc(S.client, 'create_story', storyArgs(storyFile, 'video', 60000));
    [postFile, listingFile, storyFile].forEach(age);
    const list = await orphans();
    expect(list.has(postFile)).toBe(false);
    expect(list.has(listingFile)).toBe(false);
    expect(list.has(storyFile)).toBe(false);
  });

  it('keeps a shared file while another publication still references it', async () => {
    if (!hasPsql()) return;
    const shared = await uploadImage(S, 'public-media');
    const productId = await rpc<string>(S.client, 'create_listing', listingArgs(shared));
    await rpc(S.client, 'create_post', postArgs([image(shared)]));
    age(shared);
    // Deleted by its owner, as the app does (« Supprimer l’article »).
    const del = await S.client.from('products').delete().eq('id', productId).select('id');
    expect(del.data).toHaveLength(1);
    expect((await orphans()).has(shared)).toBe(false);
  });

  it('is reserved to the service role', async () => {
    const M = await createUser('orphan_member');
    expect((await M.client.rpc('list_orphaned_media', {})).error).not.toBeNull();
    expect((await anonClient().rpc('list_orphaned_media', {})).error).not.toBeNull();
  });

  it('cleanup-media removes listed files and refuses callers without the service key', async () => {
    if (!hasPsql()) return;
    const abandoned = await uploadImage(S, 'public-media');
    age(abandoned);
    const denied = await fetch(`${SUPABASE_URL}/functions/v1/cleanup-media`, { method: 'POST', headers: { Authorization: 'Bearer nope' } });
    expect(denied.status).toBe(401);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/cleanup-media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    const exists = psql(`select count(*) from storage.objects where name = '${abandoned}'`);
    expect(exists.trim()).toBe('0');
  });
});

describe('expired statuses: files, not just rows', () => {
  it('a follower can open a status file while it is live, not once it has expired', async () => {
    const A = await createUser('st_author', { onboarded: true });
    const F = await createUser('st_follower', { onboarded: true });
    await follow(F, A);
    const path = await uploadVideo(A, 'private-media');
    const id = await rpc<string>(A.client, 'create_story', { ...storyArgs(path, 'video', 90000), p_audience: 'followers' });
    const live = await F.client.storage.from('private-media').createSignedUrl(path, 60);
    expect(live.error).toBeNull();
    const { error } = await adminClient.from('stories').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
    expect(error).toBeNull();
    const expired = await F.client.storage.from('private-media').createSignedUrl(path, 60);
    expect(expired.data?.signedUrl ?? null).toBeNull();
    expect((await F.client.from('stories').select('id').eq('id', id)).data).toHaveLength(0);
  });
});
