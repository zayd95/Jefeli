/**
 * W1.2 connected media: voice publications, one narration over photos (with « visite guidée »
 * cues), never a voice over a video; voice messages checked like publications and able to carry
 * the article they are about; statuses that point to a publication or an article without copying
 * files, never wider than the publication and gone when it is.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, createListing, createUser, expectError, follow, hasPsql, must, psql, rpc, token, uploadImage, type Bucket, type TestUser } from './helpers';

const WEBM_AUDIO = Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d', 'hex');
const MP4_BYTES = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');

async function upload(user: TestUser, bucket: Bucket, ext: string, type: string, bytes: Buffer): Promise<string> {
  const path = `${user.id}/${ext === 'webm' ? 'audio' : 'videos'}/${token(12)}.${ext}`;
  const { error } = await user.client.storage.from(bucket).upload(path, new Blob([bytes], { type }), { contentType: type });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}
const uploadAudio = (u: TestUser, bucket: Bucket = 'public-media') => upload(u, bucket, 'webm', 'audio/webm', WEBM_AUDIO);
const uploadVideo = (u: TestUser) => upload(u, 'public-media', 'mp4', 'video/mp4', MP4_BYTES);

const audio = (path: string, duration_ms: number | null, extra: Record<string, unknown> = {}) => ({ kind: 'audio', path, duration_ms, ...extra });
const image = (path: string) => ({ kind: 'image', path, width: 1, height: 1 });
const video = (path: string) => ({ kind: 'video', path, width: 720, height: 1280, duration_ms: 20000 });
const post = (media: unknown[], extra: Record<string, unknown> = {}) => ({ p_body: `Voix ${token(5)}`, p_visibility: 'public', p_media: media, p_product_ids: [], ...extra });

describe('voice in publications', () => {
  let S: TestUser;
  let O: TestUser;

  beforeAll(async () => {
    S = await createUser('voice_seller', { onboarded: true });
    O = await createUser('voice_other', { onboarded: true });
  });

  it('a voice-only publication keeps its language and waveform', async () => {
    const path = await uploadAudio(S);
    const id = await rpc<string>(S.client, 'create_post', post([audio(path, 42000, { language: 'wo', waveform: [0, 12.4, 55, 100, 140] })], { p_body: '' }));
    const row = must(await adminClient.from('post_media').select('kind, language, waveform, duration_ms').eq('post_id', id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ kind: 'audio', language: 'wo', duration_ms: 42000 });
    expect(row.waveform).toEqual([0, 12, 55, 100, 100]);
  });

  it('four photos, one narration and its « visite guidée » cues, with a tagged article', async () => {
    const photos = await Promise.all([1, 2, 3, 4].map(() => uploadImage(S, 'public-media')));
    const productId = await createListing(S);
    const voice = await uploadAudio(S);
    const cues = [{ t: 0, i: 0 }, { t: 8000, i: 1 }, { t: 15000, i: 2 }, { t: 30000, i: 3 }];
    const id = await rpc<string>(S.client, 'create_post', post([...photos.map(image), audio(voice, 60000, { language: 'fr', cues })], { p_product_ids: [productId] }));
    const rows = must(await adminClient.from('post_media').select('kind, position, cues').eq('post_id', id).order('position')) as Record<string, unknown>[];
    expect(rows.map((r) => r.kind)).toEqual(['image', 'image', 'image', 'image', 'audio']);
    expect(rows[4]!.cues).toEqual(cues);
  });

  it('refuses cues pointing past the photos or past the end of the voice, and cues without photos', async () => {
    const photo = await uploadImage(S, 'public-media');
    expectError(await S.client.rpc('create_post', post([image(photo), audio(await uploadAudio(S), 10000, { cues: [{ t: 0, i: 1 }] })])), 'invalid_cues');
    expectError(await S.client.rpc('create_post', post([image(photo), audio(await uploadAudio(S), 10000, { cues: [{ t: 12000, i: 0 }] })])), 'invalid_cues');
    expectError(await S.client.rpc('create_post', post([audio(await uploadAudio(S), 10000, { cues: [{ t: 0, i: 0 }] })])), 'invalid_cues');
  });

  it('never a voice over a video, and one voice per publication', async () => {
    expectError(await S.client.rpc('create_post', post([video(await uploadVideo(S)), audio(await uploadAudio(S), 10000)])), 'audio_with_video');
    expectError(await S.client.rpc('create_post', post([audio(await uploadAudio(S), 10000), audio(await uploadAudio(S), 10000)])), 'too_many_audio');
  });

  it('3 minutes at most, a duration is required, and the file must be audio', async () => {
    expect(await rpc<string>(S.client, 'create_post', post([audio(await uploadAudio(S), 180000)]))).toBeTruthy();
    expectError(await S.client.rpc('create_post', post([audio(await uploadAudio(S), 180001)])), 'audio_too_long');
    expectError(await S.client.rpc('create_post', post([audio(await uploadAudio(S), null)])), 'video_duration_required');
    expectError(await S.client.rpc('create_post', post([audio(await uploadImage(S, 'public-media'), 5000)])), 'invalid_media');
    expectError(await S.client.rpc('create_post', post([audio(await uploadAudio(S), 5000, { language: 'klingon' })])), 'invalid_media');
  });

  it('nobody publishes someone else’s voice', async () => {
    expectError(await O.client.rpc('create_post', post([audio(await uploadAudio(S), 5000)])), 'media_not_found');
  });
});

describe('voice messages', () => {
  let A: TestUser;
  let B: TestUser;
  let conversationId: string;
  let productId: string;

  beforeAll(async () => {
    A = await createUser('vm_buyer', { onboarded: true });
    B = await createUser('vm_seller', { onboarded: true });
    productId = await createListing(B);
    // The buyer opens the conversation from the article (product card first).
    conversationId = await rpc<string>(A.client, 'message_about_product', { p_product_id: productId });
  });

  const voice = (u: TestUser, path: string, durationMs: number, product: string | null = null) =>
    u.client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: u.id, kind: 'voice', body: '', attachment_path: path, attachment_meta: { duration_ms: durationMs }, product_id: product })
      .select('id, product_id')
      .single();

  it('a buyer sends a voice message about the article, the seller replies by voice', async () => {
    const sent = await voice(A, await uploadAudio(A, 'private-media'), 12000, productId);
    expect(sent.error).toBeNull();
    expect(sent.data?.product_id).toBe(productId);
    expect((await voice(B, await uploadAudio(B, 'private-media'), 9000)).error).toBeNull();
  });

  it('checks the file type and the 3-minute limit, and needs a duration', async () => {
    expectError(await voice(A, await uploadImage(A, 'private-media'), 5000), 'invalid_media');
    expectError(await voice(A, await uploadAudio(A, 'private-media'), 180001), 'audio_too_long');
    expectError(
      await A.client.from('messages').insert({ conversation_id: conversationId, sender_id: A.id, kind: 'voice', body: '', attachment_path: await uploadAudio(A, 'private-media'), attachment_meta: {} }),
      'video_duration_required',
    );
  });

  it('cannot point to an article the sender cannot see', async () => {
    const hidden = await createListing(B);
    must(await adminClient.from('products').update({ status: 'archived' }).eq('id', hidden));
    expectError(await voice(A, await uploadAudio(A, 'private-media'), 4000, hidden), 'invalid_product');
  });

  it('a private voice message never becomes a public post, and nobody republishes the other side’s recording', async () => {
    const mine = await uploadAudio(A, 'private-media');
    expect((await voice(A, mine, 4000)).error).toBeNull();
    // Public posts only take files from the public bucket.
    expectError(await A.client.rpc('create_post', post([audio(mine, 4000)])), 'media_not_found');
    // A followers-only post (private bucket) can only use the author's own files.
    const theirs = await uploadAudio(B, 'private-media');
    expect((await voice(B, theirs, 4000)).error).toBeNull();
    expectError(await A.client.rpc('create_post', post([audio(theirs, 4000)], { p_visibility: 'followers' })), 'media_not_found');
  });
});

describe('statuses: voice, and shared by reference', () => {
  let S: TestUser;
  let F: TestUser;
  let X: TestUser;

  beforeAll(async () => {
    S = await createUser('ref_seller', { onboarded: true });
    F = await createUser('ref_follower', { onboarded: true });
    X = await createUser('ref_stranger', { onboarded: true });
    await follow(F, S);
  });

  const visible = async (u: TestUser, id: string) => ((await u.client.from('stories').select('id').eq('id', id)).data ?? []).length === 1;

  it('a voice status: audio file, 3 minutes at most', async () => {
    const story = (path: string, ms: number) => ({ p_media_kind: 'audio', p_path: path, p_poster_path: null, p_width: null, p_height: null, p_duration_ms: ms, p_caption: 'Arrivage', p_audience: 'followers', p_product_id: null });
    expect(await rpc<string>(S.client, 'create_story', story(await uploadAudio(S, 'private-media'), 30000))).toBeTruthy();
    expectError(await S.client.rpc('create_story', story(await uploadAudio(S, 'private-media'), 180500)), 'audio_too_long');
    expectError(await S.client.rpc('create_story', story(await uploadImage(S, 'private-media'), 3000)), 'invalid_media');
  });

  it('shares a publication without copying it; expiry removes the status, not the publication or its files', async () => {
    const photo = await uploadImage(S, 'public-media');
    const postId = await rpc<string>(S.client, 'create_post', post([image(photo)]));
    const storyId = await rpc<string>(S.client, 'share_to_status', { p_post_id: postId, p_caption: 'Nouveau', p_audience: 'followers' });
    const row = must(await adminClient.from('stories').select('media_kind, storage_path, post_id').eq('id', storyId).single());
    expect(row).toEqual({ media_kind: 'post', storage_path: null, post_id: postId });
    expect(await visible(F, storyId)).toBe(true);
    expect(await visible(X, storyId)).toBe(false);

    must(await adminClient.from('stories').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', storyId));
    expect(await visible(F, storyId)).toBe(false);
    expect(((await F.client.from('posts').select('id').eq('id', postId)).data ?? []).length).toBe(1);
    if (hasPsql()) {
      psql(`update storage.objects set created_at = now() - interval '3 days' where name = '${photo}'`);
      const { data } = await adminClient.rpc('list_orphaned_media', { p_limit: 1000 });
      expect(((data ?? []) as { name: string }[]).some((r) => r.name === photo)).toBe(false);
    }
  });

  it('never wider than the publication, only your own, and gone when the publication is deleted', async () => {
    const followersPost = await rpc<string>(S.client, 'create_post', { p_body: `Abonnés ${token(4)}`, p_visibility: 'followers', p_media: [], p_product_ids: [] });
    expectError(await S.client.rpc('share_to_status', { p_post_id: followersPost, p_audience: 'public' }), 'audience_wider_than_post');
    expectError(await F.client.rpc('share_to_status', { p_post_id: followersPost, p_audience: 'followers' }), 'invalid_reference');
    expectError(await S.client.rpc('share_to_status', {}), 'invalid_reference');

    const storyId = await rpc<string>(S.client, 'share_to_status', { p_post_id: followersPost, p_audience: 'followers' });
    expect(await visible(F, storyId)).toBe(true);
    // Deleted by its author, as the app does (« Supprimer »).
    await rpc(S.client, 'delete_post', { p_post_id: followersPost });
    expect(await visible(F, storyId)).toBe(false);
  });

  it('shares an article; an archived article hides the status', async () => {
    const productId = await createListing(S);
    const storyId = await rpc<string>(S.client, 'share_to_status', { p_product_id: productId, p_audience: 'public' });
    expect(await visible(X, storyId)).toBe(true);
    expectError(await X.client.rpc('share_to_status', { p_product_id: productId, p_audience: 'public' }), 'invalid_product');
    must(await adminClient.from('products').update({ status: 'archived' }).eq('id', productId));
    expect(await visible(X, storyId)).toBe(false);
  });
});
