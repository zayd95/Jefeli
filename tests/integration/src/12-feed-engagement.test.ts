/**
 * Feed engagement pass (supabase/migrations/20261103000100_feed_engagement.sql):
 * publication intents, community votes (public upvotes, private downvotes), comment previews
 * for feed cards and the explainable feed ranking v2 of get_feed('for_you').
 *
 * The ranking tests compare the relative order of posts created here only: the candidate pool
 * also holds other recent posts (seed data, other describes of this file).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  anonClient,
  createUser,
  expectError,
  expectPermissionDenied,
  follow,
  hasPsql,
  mediaJson,
  must,
  notificationsOf,
  psql,
  rpc,
  sleep,
  uploadImage,
  type Client,
  type TestUser,
} from './helpers';

type Intent = 'share' | 'seek' | 'offer' | 'opinion';
type Visibility = 'public' | 'followers' | 'friends';

interface VoteResult {
  post_id: string;
  upvote_count: number;
  my_vote: number;
}

interface FeedRow {
  post_id: string;
  reason: string;
  /** Always null: the ranking score includes private downvote feedback and is never returned. */
  score: number | null;
  created_at: string;
}

interface PreviewRow {
  post_id: string;
  comment_id: string;
  body: string;
  created_at: string;
  by_post_author: boolean;
  author: Record<string, any>;
}

/**
 * Members who completed onboarding: since 20261105000100_refinement.sql only active, onboarded
 * members count in the public upvote count (13-refinement covers voters who did not onboard).
 */
function createUsers(...labels: string[]): Promise<TestUser[]> {
  return Promise.all(labels.map((l) => createUser(l, { onboarded: true })));
}

/** Text-only publication through the real create_post RPC. */
function textPost(user: TestUser, body: string, intent: Intent = 'share', visibility: Visibility = 'public'): Promise<string> {
  return rpc<string>(user.client, 'create_post', {
    p_body: body,
    p_visibility: visibility,
    p_media: [],
    p_product_ids: [],
    p_intent: intent,
  });
}

function vote(user: TestUser, postId: string, value: number | null) {
  return user.client.rpc('vote_post', { p_post_id: postId, p_value: value });
}

async function voteOk(user: TestUser, postId: string, value: number): Promise<VoteResult> {
  return must(await vote(user, postId, value), `vote_post(${value}) by ${user.label}`) as VoteResult;
}

/** Ground truth (service role): every vote row of a post and its public counter. */
async function voteTruth(postId: string): Promise<{ rows: { user_id: string; value: number }[]; upvotes: number }> {
  const rows = must(await adminClient.from('post_votes').select('user_id, value').eq('post_id', postId)) as {
    user_id: string;
    value: number;
  }[];
  const post = must(await adminClient.from('posts').select('upvote_count').eq('id', postId).single()) as {
    upvote_count: number;
  };
  return { rows, upvotes: post.upvote_count };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** Fixture: back-dates one of our own test posts. */
async function setPostCreatedAt(postId: string, at: Date): Promise<void> {
  must(await adminClient.from('posts').update({ created_at: at.toISOString() }).eq('id', postId), 'set post created_at');
}

/** Fixture: back-dates one of our own test comments. */
async function setCommentCreatedAt(commentId: string, at: Date): Promise<void> {
  must(await adminClient.from('comments').update({ created_at: at.toISOString() }).eq('id', commentId), 'set comment created_at');
}

/** Pages through a feed tab (the DB may hold other recent posts) and returns every row. */
async function feedRows(client: Client, tab = 'for_you', pages = 10): Promise<FeedRow[]> {
  const rows: FeedRow[] = [];
  for (let page = 0; page < pages; page++) {
    const batch = await rpc<FeedRow[]>(client, 'get_feed', { p_tab: tab, p_limit: 50, p_offset: page * 50 });
    rows.push(...batch);
    if (batch.length < 50) break;
  }
  return rows;
}

function rowOf(rows: FeedRow[], postId: string): FeedRow {
  const row = rows.find((r) => r.post_id === postId);
  expect(row, `post ${postId} missing from the feed`).toBeTruthy();
  return row!;
}

function positionOf(rows: FeedRow[], postId: string): number {
  rowOf(rows, postId);
  return rows.findIndex((r) => r.post_id === postId);
}

/** Our posts, in the order the feed ranked them. */
function rankedOrder(rows: FeedRow[], postIds: string[]): string[] {
  return [...postIds].sort((a, b) => positionOf(rows, a) - positionOf(rows, b));
}

// ---------------------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------------------

describe('Votes — one reversible vote per member and post', () => {
  let author: TestUser;
  let v1: TestUser;
  let v2: TestUser;
  let postId: string;

  beforeAll(async () => {
    [author, v1, v2] = await createUsers('vote-author', 'vote-v1', 'vote-v2');
    postId = await textPost(author, 'Que pensez-vous de ce wax ?');
  });

  it('upvote, idempotent repeat, switch to a downvote, removal, then upvote again', async () => {
    expect(await voteOk(v1, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    const stamp = async () =>
      (must(await adminClient.from('post_votes').select('updated_at').eq('post_id', postId).eq('user_id', v1.id).single()) as any)
        .updated_at as string;
    const firstStamp = await stamp();

    // Repeating the same vote changes nothing (no second row, no rewrite).
    expect(await voteOk(v1, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    expect(await voteTruth(postId)).toEqual({ rows: [{ user_id: v1.id, value: 1 }], upvotes: 1 });
    expect(await stamp()).toBe(firstStamp);

    // Switching to a downvote: the public counter drops to 0, never below.
    expect(await voteOk(v1, postId, -1)).toEqual({ post_id: postId, upvote_count: 0, my_vote: -1 });
    expect(await voteTruth(postId)).toEqual({ rows: [{ user_id: v1.id, value: -1 }], upvotes: 0 });
    expect(await voteOk(v1, postId, -1)).toEqual({ post_id: postId, upvote_count: 0, my_vote: -1 });

    // 0 removes the vote row; removing again is a harmless no-op.
    expect(await voteOk(v1, postId, 0)).toEqual({ post_id: postId, upvote_count: 0, my_vote: 0 });
    expect(await voteTruth(postId)).toEqual({ rows: [], upvotes: 0 });
    expect(await voteOk(v1, postId, 0)).toEqual({ post_id: postId, upvote_count: 0, my_vote: 0 });

    expect(await voteOk(v1, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    expect(await voteTruth(postId)).toEqual({ rows: [{ user_id: v1.id, value: 1 }], upvotes: 1 });
  });

  it('two members count twice; the public counter always matches the vote rows', async () => {
    expect(await voteOk(v2, postId, 1)).toEqual({ post_id: postId, upvote_count: 2, my_vote: 1 });
    let truth = await voteTruth(postId);
    expect(truth.upvotes).toBe(2);
    expect(truth.rows.filter((r) => r.value === 1).map((r) => r.user_id).sort()).toEqual([v1.id, v2.id].sort());
    // The upvote count is public, also for logged-out visitors.
    expect(must(await anonClient().from('posts').select('upvote_count').eq('id', postId).single())).toEqual({ upvote_count: 2 });

    // One up + one down: only the upvote is counted publicly.
    expect(await voteOk(v2, postId, -1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: -1 });
    truth = await voteTruth(postId);
    expect(truth.rows).toHaveLength(2);
    expect(truth.upvotes).toBe(truth.rows.filter((r) => r.value === 1).length);

    // Each member reads back their own vote, and only theirs.
    expect(must(await v1.client.from('post_votes').select('post_id, user_id, value'))).toEqual([
      { post_id: postId, user_id: v1.id, value: 1 },
    ]);
    expect(must(await v2.client.from('post_votes').select('post_id, user_id, value'))).toEqual([
      { post_id: postId, user_id: v2.id, value: -1 },
    ]);
  });

  it('votes and the counter have no direct write path; one row per member and post', async () => {
    expectPermissionDenied(await v1.client.from('post_votes').insert({ post_id: postId, user_id: v1.id, value: 1 }));
    expectPermissionDenied(await v1.client.from('post_votes').upsert({ post_id: postId, user_id: v1.id, value: 1 }));
    expectPermissionDenied(await v1.client.from('post_votes').update({ value: -1 }).eq('post_id', postId).eq('user_id', v1.id));
    expectPermissionDenied(await v2.client.from('post_votes').delete().eq('post_id', postId).eq('user_id', v2.id));
    expectPermissionDenied(await author.client.from('posts').update({ upvote_count: 500 }).eq('id', postId));
    expectPermissionDenied(await v1.client.from('posts').update({ upvote_count: 500 }).eq('id', postId));

    // The primary key (post_id, user_id) refuses a second row even for trusted server code.
    const dup = await adminClient.from('post_votes').insert({ post_id: postId, user_id: v1.id, value: 1 });
    expect(dup.error?.code).toBe('23505');

    const truth = await voteTruth(postId);
    expect(truth.upvotes).toBe(1);
    expect(truth.rows.map((r) => [r.user_id, r.value]).sort()).toEqual(
      [
        [v1.id, 1],
        [v2.id, -1],
      ].sort(),
    );
  });
});

describe('Votes — who may vote on what', () => {
  let author: TestUser;
  let follower: TestUser;
  let stranger: TestUser;
  let blockedByAuthor: TestUser;
  let blockerOfAuthor: TestUser;
  let suspended: TestUser;
  let pub: string;
  let followersOnly: string;

  beforeAll(async () => {
    [author, follower, stranger, blockedByAuthor, blockerOfAuthor, suspended] = await createUsers(
      'acl-author',
      'acl-follower',
      'acl-stranger',
      'acl-blocked',
      'acl-blocker',
      'acl-suspended',
    );
    expect(await follow(follower, author)).toBe('accepted');
    pub = await textPost(author, 'Publication publique');
    followersOnly = await textPost(author, 'Pour mes abonnés', 'share', 'followers');
  });

  it('logged-out visitors cannot call vote_post at all', async () => {
    expectPermissionDenied(await anonClient().rpc('vote_post', { p_post_id: pub, p_value: 1 }));
    expectPermissionDenied(await anonClient().rpc('vote_post', { p_post_id: pub, p_value: -1 }));
    expect((await voteTruth(pub)).rows).toEqual([]);
  });

  it('members cannot vote on their own posts', async () => {
    expectError(await vote(author, pub, 1), 'own_post_vote');
    expectError(await vote(author, pub, -1), 'own_post_vote');
    expect(await voteTruth(pub)).toEqual({ rows: [], upvotes: 0 });
  });

  it('only -1, 0 and 1 are valid votes; unknown posts are not found', async () => {
    for (const bad of [2, -2, 10, null]) expectError(await vote(stranger, pub, bad), 'invalid_vote');
    expectError(await vote(stranger, crypto.randomUUID(), 1), 'not_found');
    expect((await voteTruth(pub)).rows).toEqual([]);
  });

  it('a followers-only post can be voted on by followers only', async () => {
    expectError(await vote(stranger, followersOnly, 1), 'not_found');
    expectError(await vote(stranger, followersOnly, -1), 'not_found');
    expect(await voteOk(follower, followersOnly, 1)).toEqual({ post_id: followersOnly, upvote_count: 1, my_vote: 1 });
    expect(await voteTruth(followersOnly)).toEqual({ rows: [{ user_id: follower.id, value: 1 }], upvotes: 1 });
  });

  it('a block in either direction removes earlier votes between the two and prevents new ones', async () => {
    // Control: both can vote before the blocks (one up, one down).
    expect((await voteOk(blockedByAuthor, pub, 1)).my_vote).toBe(1);
    expect((await voteOk(blockerOfAuthor, pub, -1)).my_vote).toBe(-1);
    expect((await voteTruth(pub)).upvotes).toBe(1);
    // The author had also voted on the blocked member's post: that vote goes too.
    const theirs = await textPost(blockedByAuthor, 'Publication du membre bloqué');
    await voteOk(author, theirs, 1);

    must(await author.client.from('blocks').insert({ blocker_id: author.id, blocked_id: blockedByAuthor.id }));
    must(await blockerOfAuthor.client.from('blocks').insert({ blocker_id: blockerOfAuthor.id, blocked_id: author.id }));
    for (const u of [blockedByAuthor, blockerOfAuthor]) {
      for (const v of [1, -1, 0]) expectError(await vote(u, pub, v), 'not_found');
    }
    // A blocked member's past votes (up or down) no longer act on the blocker's posts.
    const truth = await voteTruth(pub);
    expect(truth.rows).toEqual([]);
    expect(truth.upvotes).toBe(0);
    expect((await voteTruth(theirs)).upvotes).toBe(0);
  });

  it('deleted and moderated posts cannot be voted on', async () => {
    const toDelete = await textPost(author, 'Bientôt supprimée');
    const toHide = await textPost(author, 'Bientôt masquée');
    const toRemove = await textPost(author, 'Bientôt retirée');
    expect((await voteOk(stranger, toHide, 1)).upvote_count).toBe(1);

    await rpc(author.client, 'delete_post', { p_post_id: toDelete });
    must(await adminClient.from('posts').update({ moderation_status: 'hidden' }).eq('id', toHide));
    must(await adminClient.from('posts').update({ moderation_status: 'removed' }).eq('id', toRemove));

    for (const id of [toDelete, toHide, toRemove]) {
      for (const v of [1, -1, 0]) expectError(await vote(stranger, id, v), 'not_found');
      expectError(await vote(follower, id, 1), 'not_found');
    }
    // The hidden post keeps its single earlier vote; nothing was added.
    expect(await voteTruth(toHide)).toEqual({ rows: [{ user_id: stranger.id, value: 1 }], upvotes: 1 });
  });

  it('suspended members cannot vote', async () => {
    must(await adminClient.from('profiles').update({ status: 'suspended' }).eq('id', suspended.id));
    for (const v of [1, -1]) expectError(await vote(suspended, pub, v), 'account_suspended');
    expect((await voteTruth(pub)).rows.map((r) => r.user_id)).not.toContain(suspended.id);
  });
});

describe('Votes — downvotes stay private', () => {
  let author: TestUser;
  let critic: TestUser;
  let other: TestUser;
  let postId: string;

  beforeAll(async () => {
    [author, critic, other] = await createUsers('priv-author', 'priv-critic', 'priv-other');
    postId = await textPost(author, 'Mon nouveau logo');
    expect(await voteOk(critic, postId, -1)).toEqual({ post_id: postId, upvote_count: 0, my_vote: -1 });
  });

  it('a vote row is readable by its voter only: not by the author, other members or visitors', async () => {
    expect(must(await critic.client.from('post_votes').select('post_id, value'))).toEqual([{ post_id: postId, value: -1 }]);
    expect(must(await author.client.from('post_votes').select('*').eq('post_id', postId))).toEqual([]);
    expect(must(await other.client.from('post_votes').select('*').eq('post_id', postId))).toEqual([]);
    expect(must(await other.client.from('post_votes').select('*').eq('user_id', critic.id))).toEqual([]);
    // Visitors may query the table (the public feed reads the viewer's own votes) but RLS has no
    // policy for them: they always get zero rows.
    expect(must(await anonClient().from('post_votes').select('*'))).toEqual([]);
    expect(must(await anonClient().from('post_votes').select('*').eq('post_id', postId))).toEqual([]);
  });

  it('posts expose the public upvote count only, never a downvote figure', async () => {
    for (const viewer of [author.client, other.client, anonClient()]) {
      const row = must(await viewer.from('posts').select('*').eq('id', postId).single()) as Record<string, unknown>;
      expect(row.upvote_count).toBe(0);
      expect(Object.keys(row).filter((k) => /vote|down|like|score/i.test(k))).toEqual(['upvote_count']);
    }
  });

  it('no downvote helper is reachable through the Data API (the global penalty was removed)', async () => {
    for (const client of [other.client, author.client, anonClient()]) {
      const viaPublic = await client.rpc('post_vote_penalty', { p_post_id: postId });
      expect(viaPublic.error, 'post_vote_penalty must not exist in the public API').toBeTruthy();
      expect(viaPublic.data).toBeNull();
      const viaPrivate = await client.schema('private').rpc('post_vote_penalty', { p_post_id: postId });
      expect(viaPrivate.error, 'the private schema must not be exposed').toBeTruthy();
      expect(viaPrivate.data).toBeNull();
    }
  });

  it.skipIf(!hasPsql())('catalog: no downvote column on posts, no write grants on post_votes for API roles', () => {
    expect(
      psql(
        `select string_agg(column_name, ',' order by column_name) from information_schema.columns
         where table_schema = 'public' and table_name = 'posts' and column_name ~ '(vote|down|like)'`,
      ),
    ).toBe('upvote_count');
    const privileges = psql(
      `select r || ':' || p || '=' || has_table_privilege(r, 'public.post_votes', p)
       from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
       order by 1`,
    ).split('\n');
    expect(privileges).toEqual([
      'anon:DELETE=false',
      'anon:INSERT=false',
      'anon:SELECT=true', // zero rows: no RLS policy for anon
      'anon:UPDATE=false',
      'authenticated:DELETE=false',
      'authenticated:INSERT=false',
      'authenticated:SELECT=true',
      'authenticated:UPDATE=false',
    ]);
    expect(psql(`select has_function_privilege('anon', 'public.vote_post(uuid, integer)', 'execute')`)).toBe('f');
  });
});

describe('Votes — notifications', () => {
  let author: TestUser;
  let fan: TestUser;
  let critic: TestUser;
  let postId: string;

  beforeAll(async () => {
    [author, fan, critic] = await createUsers('notif-author', 'notif-fan', 'notif-critic');
    postId = await textPost(author, 'Nouvelle boutique ouverte');
  });

  it("a member's first upvote notifies the author once, even after unvote / revote / switches", async () => {
    await voteOk(fan, postId, 1);
    let notes = await notificationsOf(author, 'post_upvote');
    expect(notes.map((n) => [n.actor_id, n.entity_type, n.entity_id])).toEqual([[fan.id, 'post', postId]]);

    await voteOk(fan, postId, 0);
    await voteOk(fan, postId, 1);
    await voteOk(fan, postId, -1);
    await voteOk(fan, postId, 1);
    notes = await notificationsOf(author, 'post_upvote');
    expect(notes).toHaveLength(1);
    // The voter is never notified of their own vote.
    expect(await notificationsOf(fan)).toEqual([]);
  });

  it('downvotes never notify; a later switch to an upvote counts as a first upvote', async () => {
    await voteOk(critic, postId, -1);
    expect((await notificationsOf(author)).filter((n) => n.actor_id === critic.id)).toEqual([]);
    await voteOk(critic, postId, 0);
    await voteOk(critic, postId, -1);
    expect((await notificationsOf(author)).filter((n) => n.actor_id === critic.id)).toEqual([]);

    await voteOk(critic, postId, 1);
    const actors = (await notificationsOf(author, 'post_upvote')).map((n) => n.actor_id);
    expect(actors.sort()).toEqual([fan.id, critic.id].sort());
    // Every notification of the author comes from an upvote (no other type was produced).
    expect((await notificationsOf(author)).map((n) => n.type)).toEqual(['post_upvote', 'post_upvote']);
  });

  it("the retired 'post_like' notification type no longer exists", async () => {
    const res = await adminClient.from('notifications').insert({ recipient_id: author.id, actor_id: fan.id, type: 'post_like' });
    expect(res.error?.code).toBe('23514');
  });
});

describe('Votes — rate limit', () => {
  let author: TestUser;
  let voter: TestUser;
  let other: TestUser;
  let postId: string;

  beforeAll(async () => {
    [author, voter, other] = await createUsers('rl-author', 'rl-voter', 'rl-other');
    postId = await textPost(author, 'Publication très populaire');
  });

  it.skipIf(!hasPsql())('more than 200 new votes or switches per hour are refused with rate_limited', async () => {
    // The limit uses fixed one-hour windows: never start right before a window boundary.
    const secondsLeft = Number(psql('select 3600 - floor(extract(epoch from now()))::bigint % 3600'));
    if (secondsLeft < 20) await sleep((secondsLeft + 2) * 1000);

    // Arrange: the voter already made 195 vote changes in this window (as if on 195 other posts).
    psql(
      `insert into private.rate_limits (user_id, action, window_start, hits)
       values ('${voter.id}', 'vote', to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 195)
       on conflict (user_id, action, window_start) do update set hits = excluded.hits`,
    );

    // Changes 196..200 are accepted (alternating switches on the same post count each time).
    for (const v of [1, -1, 1, -1, 1]) await voteOk(voter, postId, v);
    // The 201st change is refused and leaves the vote as it was.
    expectError(await vote(voter, postId, -1), 'rate_limited');
    expect(await voteTruth(postId)).toEqual({ rows: [{ user_id: voter.id, value: 1 }], upvotes: 1 });

    // Repeating the current vote is not a change, and removing a vote stays possible.
    expect(await voteOk(voter, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    expect(await voteOk(voter, postId, 0)).toEqual({ post_id: postId, upvote_count: 0, my_vote: 0 });
    // A new vote counts again and is refused.
    expectError(await vote(voter, postId, 1), 'rate_limited');
    expect(await voteTruth(postId)).toEqual({ rows: [], upvotes: 0 });
    expect(
      psql(
        `select hits from private.rate_limits where user_id = '${voter.id}' and action = 'vote'
         order by window_start desc limit 1`,
      ),
    ).toBe('200');

    // The limit is per member.
    expect(await voteOk(other, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
  });
});

// ---------------------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------------------

describe('Publication intents', () => {
  let author: TestUser;

  beforeAll(async () => {
    [author] = await createUsers('intent-author');
  });

  function create(body: string, media: unknown[], intent: unknown) {
    return author.client.rpc('create_post', {
      p_body: body,
      p_visibility: 'public',
      p_media: media,
      p_product_ids: [],
      p_intent: intent,
    });
  }

  it("create_post stores each intent; 'share' is the default", async () => {
    const ids = new Map<string, string>();
    for (const intent of ['share', 'seek', 'offer', 'opinion'] as const) {
      ids.set(await textPost(author, `Publication « ${intent} »`, intent), intent);
    }
    const omitted = await rpc<string>(author.client, 'create_post', { p_body: 'Sans intention', p_visibility: 'public', p_media: [] });
    ids.set(omitted, 'share');
    const explicitNull = must(await create('Intention nulle', [], null)) as string;
    ids.set(explicitNull, 'share');

    const rows = must(await anonClient().from('posts').select('id, intent').in('id', [...ids.keys()])) as {
      id: string;
      intent: string;
    }[];
    expect(rows).toHaveLength(ids.size);
    for (const r of rows) expect(r.intent).toBe(ids.get(r.id));
  });

  it('unknown intents are refused with invalid_intent', async () => {
    for (const bad of ['sell', 'SEEK', '', 'share ', 'question']) {
      expectError(await create('Texte', [], bad), 'invalid_intent');
    }
  });

  it('a request or a question needs words; sharing or offering a photo alone is fine', async () => {
    const path = await uploadImage(author, 'public-media');
    for (const intent of ['seek', 'opinion']) {
      expectError(await create('', mediaJson(path), intent), 'empty_request');
      expectError(await create('   ', mediaJson(path), intent), 'empty_request');
    }
    // Neither text nor media: empty_post, whatever the intent.
    for (const intent of ['share', 'seek', 'offer', 'opinion']) expectError(await create('  ', [], intent), 'empty_post');

    for (const intent of ['share', 'offer']) {
      const id = must(await create('', mediaJson(await uploadImage(author, 'public-media')), intent)) as string;
      const row = must(await adminClient.from('posts').select('intent, body').eq('id', id).single());
      expect(row).toEqual({ intent, body: '' });
    }
  });

  it('the intent cannot be changed by a direct update', async () => {
    const id = await textPost(author, 'Je propose des cours de couture', 'offer');
    expectPermissionDenied(await author.client.from('posts').update({ intent: 'seek' }).eq('id', id));
    expect(must(await adminClient.from('posts').select('intent').eq('id', id).single())).toEqual({ intent: 'offer' });
  });
});

// ---------------------------------------------------------------------------------------
// Comment previews
// ---------------------------------------------------------------------------------------

describe('Comment previews (get_comment_previews)', () => {
  let P: TestUser; // post author
  let C1: TestUser;
  let C2: TestUser;
  let C3: TestUser;
  let MUT: TestUser; // muted by V
  let BL1: TestUser; // blocked by V
  let BL2: TestUser; // blocks V
  let V: TestUser; // viewer with a mute and blocks
  let U: TestUser; // viewer without any
  let F: TestUser; // follower of P
  let x: string; // public post
  let y: string; // followers-only post
  const c: Record<string, string> = {};

  async function comment(user: TestUser, postId: string, body: string, minutes: number, parentId?: string): Promise<string> {
    const row = must(
      await user.client
        .from('comments')
        .insert({ post_id: postId, author_id: user.id, body, ...(parentId ? { parent_id: parentId } : {}) })
        .select('id')
        .single(),
      `comment by ${user.label}`,
    ) as { id: string };
    await setCommentCreatedAt(row.id, minutesAgo(minutes));
    return row.id;
  }

  function previews(client: Client, postIds: string[], perPost?: number): Promise<PreviewRow[]> {
    return rpc<PreviewRow[]>(client, 'get_comment_previews', {
      p_post_ids: postIds,
      ...(perPost === undefined ? {} : { p_per_post: perPost }),
    });
  }

  const ids = (rows: PreviewRow[]) => rows.map((r) => r.comment_id);

  beforeAll(async () => {
    [P, C1, C2, C3, MUT, BL1, BL2, V, U, F] = await createUsers(
      'pv-author', 'pv-c1', 'pv-c2', 'pv-c3', 'pv-muted', 'pv-bl1', 'pv-bl2', 'pv-viewer', 'pv-control', 'pv-follower',
    );
    expect(await follow(F, P)).toBe('accepted');
    x = await textPost(P, 'Où trouver du bissap bio à Dakar ?', 'seek');
    y = await textPost(P, 'Réservé à mes abonnés', 'share', 'followers');

    // Oldest → newest. The newest ones (reply, deleted, hidden) must never be previewed.
    c.a = await comment(C1, x, 'Au marché Kermel', 60);
    c.b = await comment(P, x, 'Merci ! Et à Thiès ?', 50);
    c.c = await comment(C2, x, 'Essayez aux Castors', 30);
    c.muted = await comment(MUT, x, 'Commentaire de MUT', 12);
    c.bl1 = await comment(BL1, x, 'Commentaire de BL1', 11);
    c.bl2 = await comment(BL2, x, 'Commentaire de BL2', 10);
    c.hidden = await comment(C3, x, 'Commentaire masqué', 3);
    c.deleted = await comment(C2, x, 'Commentaire supprimé', 2);
    c.reply = await comment(C1, x, 'Réponse à mon commentaire', 1, c.a);
    c.y = await comment(F, y, 'Commentaire entre abonnés', 5);

    must(await adminClient.from('comments').update({ moderation_status: 'hidden' }).eq('id', c.hidden));
    await rpc(C2.client, 'delete_comment', { p_comment_id: c.deleted });
    must(await V.client.from('mutes').insert({ muter_id: V.id, muted_id: MUT.id }));
    must(await V.client.from('blocks').insert({ blocker_id: V.id, blocked_id: BL1.id }));
    must(await BL2.client.from('blocks').insert({ blocker_id: BL2.id, blocked_id: V.id }));
  });

  it('returns the latest top-level comments, newest first, flagging the post author', async () => {
    const rows = await previews(V.client, [x]);
    expect(ids(rows)).toEqual([c.c, c.b]); // default: 2 per post
    expect(rows.map((r) => r.post_id)).toEqual([x, x]);
    expect(rows.map((r) => r.by_post_author)).toEqual([false, true]);
    expect(rows[0]!.body).toBe('Essayez aux Castors');
    expect(rows[0]!.author).toMatchObject({ id: C2.id });
    expect(rows[1]!.author).toMatchObject({ id: P.id });
    expect(new Date(rows[0]!.created_at).getTime()).toBeGreaterThan(new Date(rows[1]!.created_at).getTime());

    expect(ids(await previews(V.client, [x], 3))).toEqual([c.c, c.b, c.a]);
    // p_per_post is clamped to 1..3.
    expect(ids(await previews(V.client, [x], 10))).toEqual([c.c, c.b, c.a]);
    expect(ids(await previews(V.client, [x], 0))).toEqual([c.c]);
    expect(ids(await previews(V.client, [x], 1))).toEqual([c.c]);
  });

  it('never previews replies, deleted or hidden comments (even though they are the newest)', async () => {
    // A viewer without mutes or blocks gets the three newest eligible comments.
    expect(ids(await previews(U.client, [x], 3))).toEqual([c.bl2, c.bl1, c.muted]);
    expect(ids(await previews(anonClient(), [x], 3))).toEqual([c.bl2, c.bl1, c.muted]);
    // Not even to their own authors.
    expect(ids(await previews(C3.client, [x], 3))).not.toContain(c.hidden);
    expect(ids(await previews(C2.client, [x], 3))).not.toContain(c.deleted);
    expect(ids(await previews(C1.client, [x], 3))).not.toContain(c.reply);
  });

  it('leaves out muted members and members blocked in either direction, for that viewer only', async () => {
    const seen = ids(await previews(V.client, [x], 3));
    for (const hiddenForV of [c.muted, c.bl1, c.bl2]) expect(seen).not.toContain(hiddenForV);
    // V's mute and blocks change nothing for the other members involved.
    expect(ids(await previews(BL1.client, [x], 3))).toEqual([c.bl2, c.bl1, c.muted]);
    expect(ids(await previews(BL2.client, [x], 3))).toEqual([c.bl2, c.bl1, c.muted]);
    expect(ids(await previews(MUT.client, [x], 3))).toEqual([c.bl2, c.bl1, c.muted]);
  });

  it('returns nothing for posts the viewer cannot see', async () => {
    expect(await previews(V.client, [y], 3)).toEqual([]);
    expect(await previews(U.client, [y], 3)).toEqual([]);
    expect(await previews(anonClient(), [y], 3)).toEqual([]);
    // A follower gets both posts in one call, one preview each.
    const both = await previews(F.client, [x, y, x], 1);
    expect(both.map((r) => [r.post_id, r.comment_id]).sort()).toEqual(
      [
        [x, c.bl2],
        [y, c.y],
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------------------
// Feed ranking v2
// ---------------------------------------------------------------------------------------

describe('Feed ranking v2 (get_feed for_you)', () => {
  let Z: TestUser; // viewer without relationships
  let Y: TestUser; // control viewer
  let W: TestUser; // viewer following the authors of the boost comparison
  let voters: TestUser[];
  let authors: Record<string, TestUser>;

  beforeAll(async () => {
    [Z, Y, W] = await createUsers('rank-viewer', 'rank-control', 'rank-follower');
    voters = await createUsers('rank-v1', 'rank-v2', 'rank-v3', 'rank-v4', 'rank-v5', 'rank-v6');
    const labels = [
      'up', 'none', 'down', 'mixed', 'd1', 'd2', 'seek', 'opinion', 'offer', 'oldseek', 'answered',
      'r1', 'r2', 'muted', 'blocked', 'blocker', 'hidden', 'deleted', 'ctrl',
    ];
    const users = await createUsers(...labels.map((l) => `rank-${l}`));
    authors = Object.fromEntries(labels.map((l, i) => [l, users[i]!]));
  });

  it('upvotes lift a post; downvotes change nothing for other viewers (owner decision)', async () => {
    // Without any downvote effect the expected order is up > mixed (3 upvotes each, mixed one
    // minute older) > down > none (no upvotes, down one minute newer). The previous global
    // penalty would have pushed `down` below `none` and `mixed` down the feed for everyone.
    const at = minutesAgo(120);
    const up = await textPost(authors.up!, 'Mes nouvelles sandales en cuir');
    const none = await textPost(authors.none!, 'Mes nouveaux paniers tressés');
    const down = await textPost(authors.down!, 'Mes nouveaux bijoux');
    const mixed = await textPost(authors.mixed!, 'Mes nouveaux sacs');
    await setPostCreatedAt(up, at);
    await setPostCreatedAt(mixed, new Date(at.getTime() - 60_000));
    await setPostCreatedAt(down, new Date(at.getTime() + 60_000));
    await setPostCreatedAt(none, at);
    for (const v of voters.slice(0, 3)) {
      await voteOk(v, up, 1);
      await voteOk(v, mixed, 1);
      await voteOk(v, down, -1);
    }
    for (const v of voters.slice(3)) await voteOk(v, mixed, -1);
    expect((await voteTruth(down)).upvotes).toBe(0);
    expect((await voteTruth(mixed)).upvotes).toBe(3);

    for (const viewer of [Z.client, Y.client, anonClient()]) {
      const rows = await feedRows(viewer);
      expect(rankedOrder(rows, [none, down, mixed, up])).toEqual([up, mixed, down, none]);
      expect(rowOf(rows, up).reason).toBe('popular');
      expect(rowOf(rows, mixed).reason).toBe('popular');
      expect(rowOf(rows, down).reason).toBe(rowOf(rows, none).reason);
    }

    // The voters' own feeds are personalised: what they voted down sinks for them.
    const v0 = await feedRows(voters[0]!.client);
    expect(positionOf(v0, down)).toBeGreaterThan(positionOf(v0, none));
    const v3 = await feedRows(voters[3]!.client);
    expect(positionOf(v3, mixed)).toBeGreaterThan(positionOf(v3, none));
    expect(positionOf(v3, mixed)).toBeGreaterThan(positionOf(v3, down));
  });

  it('coordinated downvotes cannot suppress a seller for anyone else', async () => {
    const [seller, rival] = await createUsers('rank-target', 'rank-reference');
    const brigade = await createUsers('brig-1', 'brig-2', 'brig-3', 'brig-4', 'brig-5', 'brig-6');
    const target = await textPost(seller!, 'Mes nouvelles chaussures');
    const reference = await textPost(rival!, 'Mes nouveaux sacs');
    await setPostCreatedAt(reference, minutesAgo(31));
    await setPostCreatedAt(target, minutesAgo(30)); // one minute newer: ranks first by default

    const before = await feedRows(Z.client);
    expect(rankedOrder(before, [reference, target])).toEqual([target, reference]);
    for (const b of brigade) await voteOk(b, target, -1);

    for (const viewer of [Z.client, Y.client, anonClient()]) {
      expect(rankedOrder(await feedRows(viewer), [reference, target])).toEqual([target, reference]);
    }
    expect((await voteTruth(target)).upvotes).toBe(0);
    // Each brigade member only changed their own feed.
    expect(rankedOrder(await feedRows(brigade[0]!.client), [reference, target])).toEqual([reference, target]);
  });

  it("a downvote also lowers that author's other posts a little, in the voter's feed only", async () => {
    const [x, q, viewer] = await createUsers('rank-author-x', 'rank-author-q', 'rank-personal');
    const p1 = await textPost(x!, 'Première publication de X');
    const p2 = await textPost(x!, 'Deuxième publication de X');
    const q1 = await textPost(q!, 'Publication de Q');
    await setPostCreatedAt(p1, minutesAgo(10));
    await setPostCreatedAt(p2, minutesAgo(2));
    await setPostCreatedAt(q1, minutesAgo(3)); // one minute older than p2

    await voteOk(viewer!, p1, -1);
    expect(rankedOrder(await feedRows(viewer!.client), [p2, q1])).toEqual([q1, p2]);
    expect(rankedOrder(await feedRows(Z.client), [q1, p2])).toEqual([p2, q1]);
  });

  it('suspended members’ upvotes stop counting while suspended; the votes are kept for audit', async () => {
    const [author, s1, s2, s3] = await createUsers('susp-author', 'susp-1', 'susp-2', 'susp-3');
    const post = await textPost(author!, 'Publication soutenue');
    for (const v of [s1!, s2!, s3!]) await voteOk(v, post, 1);
    expect((await voteTruth(post)).upvotes).toBe(3);
    expect(rowOf(await feedRows(Z.client), post).reason).toBe('popular');

    must(await adminClient.from('profiles').update({ status: 'suspended' }).eq('id', s1!.id));
    const suspended = await voteTruth(post);
    expect(suspended.upvotes).toBe(2);
    expect(suspended.rows.map((r) => r.user_id).sort()).toEqual([s1!.id, s2!.id, s3!.id].sort());
    expect(suspended.rows.every((r) => r.value === 1)).toBe(true);
    // The public count, and therefore the ranking signal, no longer includes the suspended vote.
    expect((must(await Z.client.from('posts').select('upvote_count').eq('id', post).single()) as any).upvote_count).toBe(2);
    expect(rowOf(await feedRows(Z.client), post).reason).not.toBe('popular');

    must(await adminClient.from('profiles').update({ status: 'active' }).eq('id', s1!.id));
    expect((await voteTruth(post)).upvotes).toBe(3);
    expect(rowOf(await feedRows(Z.client), post).reason).toBe('popular');
  });

  it('author diversity: a prolific author cannot fill the top of the feed', async () => {
    const d1 = authors.d1!;
    const d2 = authors.d2!;
    const p1 = await textPost(d1, 'Arrivage 1');
    const p2 = await textPost(d1, 'Arrivage 2');
    const p3 = await textPost(d1, 'Arrivage 3');
    const other = await textPost(d2, 'Mon unique publication');
    await setPostCreatedAt(p1, minutesAgo(10));
    await setPostCreatedAt(p2, minutesAgo(20));
    await setPostCreatedAt(p3, minutesAgo(30));
    await setPostCreatedAt(other, minutesAgo(40)); // older than all three

    const rows = await feedRows(Z.client);
    // By recency alone d2's post would come last; diversity puts it right after d1's best post.
    expect(rankedOrder(rows, [p3, p2, other, p1])).toEqual([p1, other, p2, p3]);
  });

  it('recent requests and questions without enough answers are flagged needs_answers', async () => {
    const seek = await textPost(authors.seek!, 'Je cherche un tailleur à Pikine', 'seek');
    const opinion = await textPost(authors.opinion!, 'Votre avis : bleu ou vert ?', 'opinion');
    const offer = await textPost(authors.offer!, 'Je propose des cours de couture', 'offer');
    const oldSeek = await textPost(authors.oldseek!, 'Je cherche un vélo', 'seek');
    await setPostCreatedAt(oldSeek, minutesAgo(4 * 24 * 60));
    const answered = await textPost(authors.answered!, 'Je cherche du thiéboudienne livré', 'seek');
    // Three answers from three different members (since v4, answers count per distinct member;
    // 13-refinement checks that one member answering three times is not enough).
    const answers = ['Chez Fatou', 'Au restaurant du coin', 'Essayez Keur Ndeye'];
    for (const [i, body] of answers.entries()) {
      const voter = voters[i]!;
      must(await voter.client.from('comments').insert({ post_id: answered, author_id: voter.id, body }));
    }
    expect((must(await adminClient.from('posts').select('comment_count').eq('id', answered).single()) as any).comment_count).toBe(3);

    const rows = await feedRows(Z.client);
    expect(rowOf(rows, seek).reason).toBe('needs_answers');
    expect(rowOf(rows, opinion).reason).toBe('needs_answers');
    expect(rowOf(rows, offer).reason).toBe('new_seller'); // offers are not requests
    expect(rowOf(rows, oldSeek).reason).toBe('new_seller'); // older than 3 days
    expect(rowOf(rows, answered).reason).toBe('new_seller'); // already has 3 answers
    // The author sees their own post as « self ».
    expect(rowOf(await feedRows(authors.seek!.client), seek).reason).toBe('self');
  });

  it('a fresh request ranks above an otherwise equivalent shared post (+0.8)', async () => {
    const request = await textPost(authors.r1!, 'Je cherche une machine à coudre', 'seek');
    const shared = await textPost(authors.r2!, 'Ma nouvelle machine à coudre', 'share');
    const at = minutesAgo(5);
    await setPostCreatedAt(request, at);
    await setPostCreatedAt(shared, at);
    // Following both authors puts both posts at the top of their type, so no diversity penalty
    // blurs the comparison.
    await follow(W, authors.r1!);
    await follow(W, authors.r2!);

    const rows = await feedRows(W.client);
    expect(rankedOrder(rows, [shared, request])).toEqual([request, shared]);
    expect(rowOf(rows, request).reason).toBe('following');
  });

  it('never returns a score: downvotes cannot be recomputed from feed rows (regression)', async () => {
    // Before the fix, get_feed returned the score to 3 decimals, penalty included, so anyone
    // could derive a post's private downvote count from how its score moved.
    const target = await textPost(authors.ctrl!, 'Publication observée');
    const before = rowOf(await feedRows(Y.client), target);
    expect(before.score).toBeNull();
    await voteOk(voters[0]!, target, -1);
    const after = rowOf(await feedRows(Y.client), target);
    expect(after.score).toBeNull();
    expect(after.reason).toBe(before.reason);
    for (const r of [...(await feedRows(Y.client)), ...(await feedRows(anonClient()))]) {
      expect(r.score).toBeNull();
      expect(Object.keys(r).sort()).toEqual(['created_at', 'post_id', 'reason', 'score']);
    }
  });

  it('muted and blocked authors (either direction), hidden and deleted posts are absent', async () => {
    const muted = await textPost(authors.muted!, 'Publication de MU');
    const blocked = await textPost(authors.blocked!, 'Publication de BA');
    const blocker = await textPost(authors.blocker!, 'Publication de BB');
    const hidden = await textPost(authors.hidden!, 'Publication masquée');
    const deleted = await textPost(authors.deleted!, 'Publication supprimée');
    const ctrl = await textPost(authors.ctrl!, 'Publication témoin');

    // Before: Z sees them all (sanity check for the assertions below).
    let zIds = (await feedRows(Z.client)).map((r) => r.post_id);
    for (const id of [muted, blocked, blocker, hidden, deleted, ctrl]) expect(zIds).toContain(id);

    await follow(Z, authors.muted!);
    must(await Z.client.from('mutes').insert({ muter_id: Z.id, muted_id: authors.muted!.id }));
    must(await Z.client.from('blocks').insert({ blocker_id: Z.id, blocked_id: authors.blocked!.id }));
    must(await authors.blocker!.client.from('blocks').insert({ blocker_id: authors.blocker!.id, blocked_id: Z.id }));
    must(await adminClient.from('posts').update({ moderation_status: 'hidden' }).eq('id', hidden));
    await rpc(authors.deleted!.client, 'delete_post', { p_post_id: deleted });

    zIds = (await feedRows(Z.client)).map((r) => r.post_id);
    expect(zIds).toContain(ctrl);
    for (const id of [muted, blocked, blocker, hidden, deleted]) expect(zIds).not.toContain(id);
    // A muted author stays out of the following tab even though Z follows them.
    expect((await feedRows(Z.client, 'following')).map((r) => r.post_id)).not.toContain(muted);

    // Mutes and blocks are Z's own: another member still sees those authors.
    const yIds = (await feedRows(Y.client)).map((r) => r.post_id);
    for (const id of [muted, blocked, blocker, ctrl]) expect(yIds).toContain(id);
    for (const id of [hidden, deleted]) expect(yIds).not.toContain(id);
    const anonIds = (await feedRows(anonClient())).map((r) => r.post_id);
    for (const id of [hidden, deleted]) expect(anonIds).not.toContain(id);
  });
});

// ---------------------------------------------------------------------------------------
// Data export
// ---------------------------------------------------------------------------------------

describe('export_my_data includes the member’s own votes', () => {
  it("lists the caller's votes (both directions) and nobody else's", async () => {
    const [author, voter, other] = await createUsers('exp-author', 'exp-voter', 'exp-other');
    const p1 = await textPost(author, 'Publication 1');
    const p2 = await textPost(author, 'Publication 2');
    await voteOk(voter, p1, 1);
    await voteOk(voter, p2, -1);
    await voteOk(other, p1, 1);

    const dump = await rpc<Record<string, any>>(voter.client, 'export_my_data');
    expect((dump.post_votes as any[]).map((v) => [v.post_id, v.value]).sort()).toEqual(
      [
        [p1, 1],
        [p2, -1],
      ].sort(),
    );
    for (const v of dump.post_votes as any[]) expect(v.updated_at).toBeTruthy();

    expect((await rpc<Record<string, any>>(other.client, 'export_my_data')).post_votes).toEqual([
      expect.objectContaining({ post_id: p1, value: 1 }),
    ]);
    // The author's export does not reveal who voted on their posts.
    const authorDump = await rpc<Record<string, any>>(author.client, 'export_my_data');
    expect(authorDump.post_votes).toEqual([]);
    expect(JSON.stringify(authorDump)).not.toContain(voter.id);
    expect(JSON.stringify(authorDump)).not.toContain(other.id);
  });
});

// ---------------------------------------------------------------------------------------
// Defense in depth: private functions reachable by the API roles
// ---------------------------------------------------------------------------------------

describe('private.* functions executable by anon/authenticated', () => {
  it('are exactly the helpers RLS policies need (allowlist)', () => {
    // New private functions get EXECUTE for PUBLIC by default. Every one must be revoked unless
    // a policy (or a security invoker function such as get_feed) calls it. A trigger function
    // left executable (private.notify_post_upvote) was caught by this check.
    const exposed = psql(
      `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
       order by 1`,
    )
      .split('\n')
      .filter(Boolean);
    expect(exposed).toEqual([
      'are_friends(a uuid, b uuid)',
      'audience_allows(viewer uuid, owner uuid, audience text)',
      'can_read_private_media(p_path text)',
      'can_view_live(p_session_id uuid)',
      'can_view_post(p_post_id uuid)',
      'can_view_product(p_product_id uuid)',
      'can_view_profile_content(viewer uuid, owner uuid)',
      'can_view_story(p_story_id uuid)',
      'follows_accepted(follower uuid, followee uuid)',
      'has_blocked(blocker uuid, target uuid)',
      'is_active_user(uid uuid)',
      'is_admin()',
      'is_blocked_between(a uuid, b uuid)',
      'is_member(p_conversation_id uuid)',
      'is_staff()',
      'normalize_text(t text)',
    ]);
  });
});
