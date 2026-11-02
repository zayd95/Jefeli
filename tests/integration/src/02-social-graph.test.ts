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
  makeFriends,
  must,
  notificationsOf,
  rpc,
  token,
  trySignedUrl,
  type TestUser,
} from './helpers';

describe('SOC-01 — follows and counters', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let P: TestUser; // private account

  beforeAll(async () => {
    [A, B, C, P] = await Promise.all([
      createUser('A'),
      createUser('B'),
      createUser('C'),
      createUser('P', { profile: { is_private: true } }),
    ]);
  });

  it("A follows B → B.followers_count and A.following_count increment; unfollow reverses", async () => {
    expect((await adminProfile(B.id)).followers_count).toBe(0);
    expect(await follow(A, B)).toBe('accepted');

    const b = must(await A.client.from('profiles').select('followers_count').eq('id', B.id).single()) as any;
    expect(b.followers_count).toBe(1);
    expect((await adminProfile(A.id)).following_count).toBe(1);

    must(await A.client.from('follows').delete().eq('follower_id', A.id).eq('followee_id', B.id));
    expect((await adminProfile(B.id)).followers_count).toBe(0);
    expect((await adminProfile(A.id)).following_count).toBe(0);
  });

  it('nobody can create a follow on behalf of someone else', async () => {
    expectRlsViolation(await A.client.from('follows').insert({ follower_id: C.id, followee_id: B.id }));
    expect((await adminProfile(B.id)).followers_count).toBe(0);
  });

  it('following a private account creates a pending request; the client cannot force "accepted"', async () => {
    // `status` is not an insertable column for clients.
    expectPermissionDenied(
      await A.client.from('follows').insert({ follower_id: A.id, followee_id: P.id, status: 'accepted' }),
    );
    expect(await follow(A, P)).toBe('pending');
    expect((await adminProfile(P.id)).followers_count).toBe(0);
    // P got a follow *request* notification, not a follow.
    const reqs = await notificationsOf(P, 'follow_request');
    expect(reqs.map((n) => n.actor_id)).toContain(A.id);
  });

  it('only the followee can accept a pending request', async () => {
    // The follower cannot self-accept, a third party cannot either (RLS filters the row).
    expectNoRowsAffected(
      await A.client.from('follows').update({ status: 'accepted' }).eq('follower_id', A.id).eq('followee_id', P.id).select(),
    );
    expectNoRowsAffected(
      await C.client.from('follows').update({ status: 'accepted' }).eq('follower_id', A.id).eq('followee_id', P.id).select(),
    );
    expect((await adminProfile(P.id)).followers_count).toBe(0);

    const rows = must(
      await P.client
        .from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', A.id)
        .eq('followee_id', P.id)
        .select('status, accepted_at'),
    ) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('accepted');
    expect(rows[0].accepted_at).toBeTruthy();
    expect((await adminProfile(P.id)).followers_count).toBe(1);
    const accepted = await notificationsOf(A, 'follow_accepted');
    expect(accepted.map((n) => n.actor_id)).toContain(P.id);
  });

  it('an accepted follow cannot be turned back into pending by the followee', async () => {
    const res = await P.client
      .from('follows')
      .update({ status: 'pending' })
      .eq('follower_id', A.id)
      .eq('followee_id', P.id)
      .select();
    expect(res.error).toBeTruthy();
  });

  it("a private account's follower list is hidden from non-followers and anonymous visitors", async () => {
    // A is now an accepted follower of the private account P.
    expect(must(await A.client.from('follows').select('follower_id').eq('followee_id', P.id))).toEqual([{ follower_id: A.id }]);
    expect(must(await P.client.from('follows').select('follower_id').eq('followee_id', P.id))).toHaveLength(1);
    // Who follows / is followed by a private account is part of its private social graph.
    expect(must(await C.client.from('follows').select('follower_id').eq('followee_id', P.id))).toHaveLength(0);
    expect(must(await anonClient().from('follows').select('follower_id').eq('followee_id', P.id))).toHaveLength(0);
    // The public counter stays visible.
    expect(((await anonClient().from('profiles').select('followers_count').eq('id', P.id).single()).data as any).followers_count).toBe(1);
  });

  it("a private account's followers-only content is visible to accepted followers only", async () => {
    const post = await createPost(P, 'public', 'Compte privé, post public');
    // Public visibility on a private account still requires an accepted follow.
    expect(await canSee(A.client, 'posts', post.id)).toBe(true);
    expect(await canSee(C.client, 'posts', post.id)).toBe(false);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(false);
  });
});

describe('Notifications', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
  });

  it('a follow creates a notification that only the recipient can read or mark read', async () => {
    await follow(A, B);
    const [n] = await notificationsOf(B, 'follow');
    expect(n).toBeTruthy();
    expect(n!.actor_id).toBe(A.id);
    expect(n!.entity_id).toBe(A.id);

    expect(await canSee(A.client, 'notifications', n!.id)).toBe(false);
    expect(await canSee(C.client, 'notifications', n!.id)).toBe(false);
    expectPermissionDenied(await anonClient().from('notifications').select('*').eq('id', n!.id));

    expectNoRowsAffected(
      await A.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n!.id).select(),
    );
    expectNoRowsAffected(await A.client.from('notifications').delete().eq('id', n!.id).select());
    expectPermissionDenied(await B.client.from('notifications').update({ type: 'message' }).eq('id', n!.id));

    const marked = must(
      await B.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n!.id).select('read_at'),
    ) as any[];
    expect(marked[0].read_at).toBeTruthy();
  });

  it('clients cannot forge notifications', async () => {
    expectPermissionDenied(
      await A.client.from('notifications').insert({ recipient_id: B.id, actor_id: A.id, type: 'message' }),
    );
  });

  it('a blocked actor creates no notification', async () => {
    // Z owns a public post; X comments on it; Y replies to X's comment.
    const [X, Y, Z] = await Promise.all([createUser('X'), createUser('Y'), createUser('Z')]);
    const post = await createPost(Z, 'public', 'Post de Z');
    const xComment = must(
      await X.client.from('comments').insert({ post_id: post.id, author_id: X.id, body: 'Joli !' }).select('id').single(),
    ) as { id: string };

    // Control: before any block, the reply notifies X.
    must(await Y.client.from('comments').insert({ post_id: post.id, author_id: Y.id, parent_id: xComment.id, body: 'Oui' }));
    expect((await notificationsOf(X, 'comment_reply')).map((n) => n.actor_id)).toEqual([Y.id]);

    // X blocks Y. Y can no longer reply under X's comment, but can still comment at the
    // top level of Z's post (Z did not block anyone)...
    must(await X.client.from('blocks').insert({ blocker_id: X.id, blocked_id: Y.id }));
    expectError(
      await Y.client.from('comments').insert({ post_id: post.id, author_id: Y.id, parent_id: xComment.id, body: 'Encore' }),
      'blocked',
    );
    must(await Y.client.from('comments').insert({ post_id: post.id, author_id: Y.id, body: 'Encore' }));
    // ...and X receives no new notification from Y, while Z still does.
    expect(await notificationsOf(X, 'comment_reply')).toHaveLength(1);
    expect((await notificationsOf(Z, 'post_comment')).filter((n) => n.actor_id === Y.id)).toHaveLength(2);

    // A follow attempt across the block is rejected and creates nothing either.
    expectError(await Y.client.from('follows').insert({ follower_id: Y.id, followee_id: X.id }), 'blocked');
    expect((await notificationsOf(X)).filter((n) => n.actor_id === Y.id).map((n) => n.type)).toEqual(['comment_reply']);
  });
});

describe('Friendships', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let requestId: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
  });

  it('A sends a friend request; only the receiver can respond', async () => {
    expect(await rpc(A.client, 'send_friend_request', { p_target: B.id })).toBe('pending');
    const req = must(await B.client.from('friend_requests').select('*').eq('sender_id', A.id).single()) as any;
    requestId = req.id;
    expect(req.status).toBe('pending');
    // A third party cannot see or answer it.
    expect(await canSee(C.client, 'friend_requests', requestId)).toBe(false);
    expectError(await C.client.rpc('respond_friend_request', { p_request_id: requestId, p_accept: true }), 'not_found');
    // The sender cannot accept their own request.
    expectError(await A.client.rpc('respond_friend_request', { p_request_id: requestId, p_accept: true }), 'not_found');
    // Clients cannot write friend requests / friendships directly.
    expectPermissionDenied(await C.client.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId));
    expectPermissionDenied(
      await C.client.from('friendships').insert({ user_a: [A.id, C.id].sort()[0], user_b: [A.id, C.id].sort()[1] }),
    );
    expect((await adminProfile(A.id)).friends_count).toBe(0);
  });

  it('the receiver accepts → friendship exists, counters and notification', async () => {
    expect(await rpc(B.client, 'respond_friend_request', { p_request_id: requestId, p_accept: true })).toBe('accepted');
    expect((await adminProfile(A.id)).friends_count).toBe(1);
    expect((await adminProfile(B.id)).friends_count).toBe(1);
    const rel = await rpc<Record<string, any>>(A.client, 'relationship_with', { p_target: B.id });
    expect(rel.is_friend).toBe(true);
    expect((await notificationsOf(A, 'friend_accepted')).map((n) => n.actor_id)).toContain(B.id);
    // Responding twice is an invalid transition.
    expectError(
      await B.client.rpc('respond_friend_request', { p_request_id: requestId, p_accept: true }),
      'invalid_transition',
    );
  });

  it('friends-only posts (and their private media) are visible to friends only', async () => {
    // C follows B but is not a friend: followers are not enough for a friends-only post.
    await follow(C, B);
    const post = await createPost(B, 'friends', 'Réservé aux amis');
    expect(post.bucket).toBe('private-media');

    expect(await canSee(A.client, 'posts', post.id)).toBe(true);
    expect(await canSee(C.client, 'posts', post.id)).toBe(false);
    expect(await canSee(anonClient(), 'posts', post.id)).toBe(false);

    const urlA = await trySignedUrl(A.client, 'private-media', post.mediaPath);
    expect(urlA).toBeTruthy();
    expect((await fetch(urlA!)).status).toBe(200);
    expect(await trySignedUrl(C.client, 'private-media', post.mediaPath)).toBeNull();
  });
});

describe('Blocks', () => {
  let A: TestUser;
  let B: TestUser;
  let postId: string;
  let productId: string;
  let conversationId: string;
  const tok = token(10);

  beforeAll(async () => {
    [A, B] = await Promise.all([
      createUser('A'),
      createUser('B', { displayName: `Bloqueur ${tok}`, profile: { onboarded_at: new Date().toISOString() } }),
    ]);
    await follow(A, B);
    await follow(B, A);
    await makeFriends(A, B);
    postId = (await createPost(B, 'public', `Post de B ${tok}`)).id;
    productId = await createListing(B, { title: `Sac ${tok}` });
    conversationId = await rpc<string>(A.client, 'get_or_create_conversation', { p_other: B.id });
    must(await A.client.from('messages').insert({ conversation_id: conversationId, sender_id: A.id, body: 'Salut' }));

    // Before the block A sees everything (sanity check for the assertions below).
    expect(await canSee(A.client, 'profiles', B.id)).toBe(true);
    expect(await canSee(A.client, 'posts', postId)).toBe(true);
    expect(await canSee(A.client, 'products', productId)).toBe(true);
    const feed = await rpc<any[]>(A.client, 'get_feed', { p_tab: 'following', p_limit: 50 });
    expect(feed.map((r) => r.post_id)).toContain(postId);

    must(await B.client.from('blocks').insert({ blocker_id: B.id, blocked_id: A.id }));
  });

  it('severs follows in both directions and the friendship', async () => {
    const { data: follows } = await adminClient
      .from('follows')
      .select('*')
      .or(`and(follower_id.eq.${A.id},followee_id.eq.${B.id}),and(follower_id.eq.${B.id},followee_id.eq.${A.id})`);
    expect(follows).toHaveLength(0);
    const a = await adminProfile(A.id);
    const b = await adminProfile(B.id);
    expect([a.followers_count, a.following_count, a.friends_count]).toEqual([0, 0, 0]);
    expect([b.followers_count, b.following_count, b.friends_count]).toEqual([0, 0, 0]);
  });

  it("A can no longer see B's profile, posts, products or post comments", async () => {
    expect(await canSee(A.client, 'profiles', B.id)).toBe(false);
    expect(await canSee(A.client, 'posts', postId)).toBe(false);
    expect(await canSee(A.client, 'products', productId)).toBe(false);
    expect(await canSee(A.client, 'boutiques', B.id, 'owner_id')).toBe(false);
  });

  it("A cannot comment on or vote on B's posts", async () => {
    const c = await A.client.from('comments').insert({ post_id: postId, author_id: A.id, body: 'Coucou' });
    expect(c.error).toBeTruthy();
    // Votes go through vote_post only, which applies the same visibility rules (blocks) as reading.
    expectError(await A.client.rpc('vote_post', { p_post_id: postId, p_value: 1 }), 'not_found');
    expectError(await A.client.rpc('vote_post', { p_post_id: postId, p_value: -1 }), 'not_found');
    const truth = must(await adminClient.from('posts').select('upvote_count').eq('id', postId).single()) as any;
    expect(truth.upvote_count).toBe(0);
    expect(must(await adminClient.from('post_votes').select('user_id').eq('post_id', postId))).toEqual([]);
  });

  it('A cannot open a conversation with B or keep messaging in the old one', async () => {
    expectError(await A.client.rpc('get_or_create_conversation', { p_other: B.id }), 'blocked');
    expectError(
      await A.client.from('messages').insert({ conversation_id: conversationId, sender_id: A.id, body: 'Tu es là ?' }),
      'blocked',
    );
    // The blocker cannot message the blocked user either.
    expectError(
      await B.client.from('messages').insert({ conversation_id: conversationId, sender_id: B.id, body: 'Non' }),
      'blocked',
    );
    expectError(await A.client.rpc('message_about_product', { p_product_id: productId, p_body: 'Dispo ?' }), 'not_found');
    expectError(
      await A.client.rpc('make_offer', { p_product_id: productId, p_kind: 'price', p_amount_xof: 1000 }),
      'not_found',
    );
  });

  it('A cannot re-follow or re-friend B', async () => {
    expectError(await A.client.from('follows').insert({ follower_id: A.id, followee_id: B.id }), 'blocked');
    expectError(await A.client.rpc('send_friend_request', { p_target: B.id }), 'blocked');
  });

  it("feed, product browse and profile search exclude B for A", async () => {
    for (const tab of ['following', 'for_you']) {
      const feed = await rpc<any[]>(A.client, 'get_feed', { p_tab: tab, p_limit: 50 });
      expect(feed.map((r) => r.post_id)).not.toContain(postId);
    }
    const products = await rpc<any[]>(A.client, 'browse_products', { p_query: tok });
    expect(products.map((p) => p.id)).not.toContain(productId);
    const people = await rpc<any[]>(A.client, 'search_profiles', { p_query: tok });
    expect(people.map((p) => p.id)).not.toContain(B.id);
    // Control: a third party still finds B.
    const D = await createUser('D');
    expect((await rpc<any[]>(D.client, 'search_profiles', { p_query: tok })).map((p) => p.id)).toContain(B.id);
  });

  it('B still sees A (to manage the block list); A cannot see or remove the block', async () => {
    expect(await canSee(B.client, 'profiles', A.id)).toBe(true);
    const list = must(await B.client.from('blocks').select('blocked_id')) as any[];
    expect(list.map((r) => r.blocked_id)).toEqual([A.id]);
    expectNoRowsAffected(await A.client.from('blocks').select('*').eq('blocker_id', B.id));
    expectNoRowsAffected(await A.client.from('blocks').delete().eq('blocker_id', B.id).select());
    expect(must(await B.client.from('blocks').select('blocked_id'))).toHaveLength(1);
    // Nobody can block on behalf of someone else.
    const E = await createUser('E');
    expectRlsViolation(await A.client.from('blocks').insert({ blocker_id: E.id, blocked_id: B.id }));
  });
});
