import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  adminProfile,
  anonClient,
  canSee,
  createListing,
  createPost,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  expectRlsViolation,
  follow,
  mediaJson,
  must,
  notificationsOf,
  rpc,
  trySignedUrl,
  uploadImage,
  type Client,
  type PostFixture,
  type TestUser,
} from './helpers';

describe('SOC-02 — public post with photo: reactions, counters, ownership', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let post: PostFixture;
  let commentId: string;

  beforeAll(async () => {
    // A votes: only onboarded members count in the public upvote count (20261105000100_refinement).
    [A, B, C] = await Promise.all([createUser('A', { onboarded: true }), createUser('B'), createUser('C')]);
    post = await createPost(B, 'public', 'Nouvelle collection de wax 🌍');
  });

  it("B's public post (with uploaded image) is visible to A and to logged-out visitors", async () => {
    expect(post.bucket).toBe('public-media');
    const row = must(await A.client.from('posts').select('*, post_media(*)').eq('id', post.id).single()) as any;
    expect(row.author_id).toBe(B.id);
    expect(row.post_media).toHaveLength(1);
    expect(row.post_media[0].storage_path).toBe(post.mediaPath);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(true);
    // The public file is really served.
    const { data } = anonClient().storage.from('public-media').getPublicUrl(post.mediaPath);
    expect((await fetch(data.publicUrl)).status).toBe(200);
    expect((await adminProfile(B.id)).posts_count).toBe(1);
  });

  it('A upvotes, comments and saves; counters and notifications follow', async () => {
    expect(await rpc(A.client, 'vote_post', { p_post_id: post.id, p_value: 1 })).toEqual({
      post_id: post.id,
      upvote_count: 1,
      my_vote: 1,
    });
    commentId = (
      must(
        await A.client.from('comments').insert({ post_id: post.id, author_id: A.id, body: 'Magnifique !' }).select('id').single(),
      ) as any
    ).id;
    must(await A.client.from('post_saves').insert({ user_id: A.id, post_id: post.id }));

    const counters = must(
      await A.client.from('posts').select('upvote_count, comment_count, save_count').eq('id', post.id).single(),
    );
    expect(counters).toEqual({ upvote_count: 1, comment_count: 1, save_count: 1 });
    expect((await notificationsOf(B, 'post_upvote')).map((n) => n.actor_id)).toEqual([A.id]);
    expect((await notificationsOf(B, 'post_comment')).map((n) => n.actor_id)).toEqual([A.id]);

    // Saves are private to the saver.
    expect(must(await A.client.from('post_saves').select('post_id'))).toEqual([{ post_id: post.id }]);
    expectNoRowsAffected(await B.client.from('post_saves').select('*').eq('user_id', A.id));
  });

  it('reactions cannot be forged in the name of someone else', async () => {
    // Votes have no direct write path at all: vote_post() always votes as the caller.
    expectPermissionDenied(await A.client.from('post_votes').insert({ post_id: post.id, user_id: C.id, value: 1 }));
    expectRlsViolation(await A.client.from('comments').insert({ post_id: post.id, author_id: C.id, body: 'Faux' }));
    expectRlsViolation(await A.client.from('post_saves').insert({ post_id: post.id, user_id: C.id }));
    // Counter columns are not writable at all.
    expectPermissionDenied(await B.client.from('posts').update({ upvote_count: 9999 }).eq('id', post.id));
    const truth = must(await adminClient.from('posts').select('upvote_count').eq('id', post.id).single()) as any;
    expect(truth.upvote_count).toBe(1);
  });

  it("A cannot edit, soft-delete or delete B's post", async () => {
    expectNoRowsAffected(await A.client.from('posts').update({ body: 'Piraté' }).eq('id', post.id).select());
    // Soft-delete is only possible through the owner-checked RPC; the column is not writable.
    expectPermissionDenied(await A.client.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', post.id));
    expectError(await A.client.rpc('delete_post', { p_post_id: post.id }), 'not_found');
    expectPermissionDenied(await A.client.from('posts').delete().eq('id', post.id));
    const truth = must(await adminClient.from('posts').select('body, deleted_at').eq('id', post.id).single()) as any;
    expect(truth).toEqual({ body: 'Nouvelle collection de wax 🌍', deleted_at: null });
  });

  it('posts can only be created through create_post, with media the caller really uploaded', async () => {
    expectPermissionDenied(await A.client.from('posts').insert({ author_id: A.id, body: 'direct' }));
    expectPermissionDenied(await A.client.from('post_media').insert({ post_id: post.id, owner_id: A.id }));
    // Referencing B's uploaded file is refused.
    expectError(
      await A.client.rpc('create_post', { p_body: 'vol', p_visibility: 'public', p_media: mediaJson(post.mediaPath) }),
      'media_not_found',
    );
    // A file in the wrong bucket for the audience is refused (followers-only needs private-media).
    const publicPath = await uploadImage(A, 'public-media');
    expectError(
      await A.client.rpc('create_post', { p_body: 'x', p_visibility: 'followers', p_media: mediaJson(publicPath) }),
      'media_not_found',
    );
    // Tagging another seller's product is refused.
    const bProduct = await createListing(B, { title: 'Produit de B' });
    expectError(
      await A.client.rpc('create_post', { p_body: 'tag', p_visibility: 'public', p_media: [], p_product_ids: [bProduct] }),
      'invalid_product',
    );
    // Nobody can upload into somebody else's folder.
    const up = await A.client.storage
      .from('public-media')
      .upload(`${B.id}/intrus.png`, new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { contentType: 'image/png' });
    expect(up.error).toBeTruthy();
  });

  it('public buckets refuse active content types (HTML / SVG) to prevent stored XSS', async () => {
    for (const [name, type, body] of [
      ['page.html', 'text/html', '<script>alert(1)</script>'],
      ['image.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
    ] as const) {
      for (const bucket of ['public-media', 'avatars'] as const) {
        const res = await A.client.storage
          .from(bucket)
          .upload(`${A.id}/${name}`, new Blob([body], { type }), { contentType: type });
        expect(res.error, `${bucket}/${name} should be rejected`).toBeTruthy();
      }
    }
  });

  it('comment deletion: the post author may remove comments, a third party may not', async () => {
    expectError(await C.client.rpc('delete_comment', { p_comment_id: commentId }), 'not_found');
    expectNoRowsAffected(await C.client.from('comments').update({ body: 'edit' }).eq('id', commentId).select());
    await rpc(B.client, 'delete_comment', { p_comment_id: commentId });
    expect(await canSee(A.client, 'comments', commentId)).toBe(false);
    const counters = must(await A.client.from('posts').select('comment_count').eq('id', post.id).single()) as any;
    expect(counters.comment_count).toBe(0);
  });

  it('removing the vote decrements the counter', async () => {
    expect(await rpc(A.client, 'vote_post', { p_post_id: post.id, p_value: 0 })).toEqual({
      post_id: post.id,
      upvote_count: 0,
      my_vote: 0,
    });
    const counters = must(await A.client.from('posts').select('upvote_count').eq('id', post.id).single()) as any;
    expect(counters.upvote_count).toBe(0);
  });

  it('the author can edit the text of their own post', async () => {
    const rows = must(
      await B.client.from('posts').update({ body: 'Collection mise à jour' }).eq('id', post.id).select('body, edited_at'),
    ) as any[];
    expect(rows[0].body).toBe('Collection mise à jour');
    expect(rows[0].edited_at).toBeTruthy();
  });

  it('the author can soft-delete their own post, which then disappears for everyone else', async () => {
    const own = await createPost(B, 'public', 'À supprimer');
    const res = await B.client.rpc('delete_post', { p_post_id: own.id });
    expect(res.error, res.error?.message).toBeNull();
    const truth = must(await adminClient.from('posts').select('deleted_at').eq('id', own.id).single()) as any;
    expect(truth.deleted_at).toBeTruthy();
    expect(await canSee(A.client, 'posts', own.id)).toBe(false);
    expect(await canSee(anonClient(), 'posts', own.id)).toBe(false);
  });
});

describe('SOC-02 — followers-only post and its private media', () => {
  let B: TestUser;
  let follower: TestUser;
  let stranger: TestUser;
  let post: PostFixture;

  beforeAll(async () => {
    [B, follower, stranger] = await Promise.all([createUser('B'), createUser('follower'), createUser('stranger')]);
    expect(await follow(follower, B)).toBe('accepted');
    post = await createPost(B, 'followers', 'Pour mes abonnés seulement');
  });

  it('is visible to an accepted follower only (not to non-followers nor anonymous)', async () => {
    expect(post.bucket).toBe('private-media');
    expect(await canSee(follower.client, 'posts', post.id)).toBe(true);
    expect(await canSee(stranger.client, 'posts', post.id)).toBe(false);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(false);
    expect(await canSee(follower.client, 'post_media', post.id, 'post_id')).toBe(true);
    expect(await canSee(stranger.client, 'post_media', post.id, 'post_id')).toBe(false);
  });

  it('a non-follower cannot react to it', async () => {
    expectError(await stranger.client.rpc('vote_post', { p_post_id: post.id, p_value: 1 }), 'not_found');
    expectRlsViolation(
      await stranger.client.from('comments').insert({ post_id: post.id, author_id: stranger.id, body: 'Je vois tout' }),
    );
  });

  it('private-bucket media: non-follower cannot get a signed URL, follower can', async () => {
    expect(await trySignedUrl(stranger.client, 'private-media', post.mediaPath)).toBeNull();
    expect(await trySignedUrl(anonClient(), 'private-media', post.mediaPath)).toBeNull();
    const direct = await stranger.client.storage.from('private-media').download(post.mediaPath);
    expect(direct.error).toBeTruthy();

    const url = await trySignedUrl(follower.client, 'private-media', post.mediaPath);
    expect(url).toBeTruthy();
    expect((await fetch(url!)).status).toBe(200);
  });

  it('unfollowing removes access again', async () => {
    must(await follower.client.from('follows').delete().eq('follower_id', follower.id).eq('followee_id', B.id));
    expect(await canSee(follower.client, 'posts', post.id)).toBe(false);
    expect(await trySignedUrl(follower.client, 'private-media', post.mediaPath)).toBeNull();
  });
});

describe('Home feed (get_feed)', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let pub: PostFixture;
  let followersOnly: PostFixture;
  let friendsOnly: PostFixture;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    await follow(A, B);
    pub = await createPost(B, 'public');
    followersOnly = await createPost(B, 'followers');
    friendsOnly = await createPost(B, 'friends');
  });

  it('following tab lists followed authors with an explainable reason', async () => {
    const following = await rpc<any[]>(A.client, 'get_feed', { p_tab: 'following', p_limit: 50 });
    const ids = following.map((r) => r.post_id);
    expect(ids).toContain(pub.id);
    expect(ids).toContain(followersOnly.id);
    expect(ids).not.toContain(friendsOnly.id);
    expect(following.find((r) => r.post_id === pub.id)?.reason).toBe('following');
  });

  /** Pages through a feed tab (the DB may hold other recent posts) and returns every post id. */
  async function feedIds(client: Client, tab: string, pages = 6): Promise<string[]> {
    const ids: string[] = [];
    for (let page = 0; page < pages; page++) {
      const rows = await rpc<any[]>(client, 'get_feed', { p_tab: tab, p_limit: 50, p_offset: page * 50 });
      ids.push(...rows.map((r) => r.post_id));
      if (rows.length < 50) break;
    }
    return ids;
  }

  it('for_you never leaks followers-only or friends-only posts to a non-follower', async () => {
    const seen = await feedIds(C.client, 'for_you');
    expect(seen).toContain(pub.id);
    expect(seen).not.toContain(followersOnly.id);
    expect(seen).not.toContain(friendsOnly.id);
  });

  it('logged-out visitors can load the public feed (get_feed is granted to anon)', async () => {
    const anon = anonClient();
    const res = await anon.rpc('get_feed', { p_tab: 'for_you', p_limit: 50 });
    expect(res.error, res.error?.message).toBeNull();
    const seen = await feedIds(anon, 'for_you');
    expect(seen).toContain(pub.id);
    expect(seen).not.toContain(followersOnly.id);
    expect(seen).not.toContain(friendsOnly.id);
  });
});
