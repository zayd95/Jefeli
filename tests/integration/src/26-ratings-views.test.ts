/**
 * ⭐ ratings, 👁 views and « Apprécié » (supabase/migrations/20261121000100_post_ratings_views.sql):
 *   - rate_post: 1–5, change, withdraw (0); not on your own post; invisible posts are not found;
 *   - the public average exists only from 5 genuine ratings, and nobody can list who rated what;
 *   - views are counted once per member and per post, never for the author or a DÉMO account, and only the author reads them;
 *   - member_appreciation counts DISTINCT genuine members (active, onboarded, ≥ 14 days) in tiers 10 / 50 / 200.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient, createUser, expectError, expectPermissionDenied, follow, must, rpc, type TestUser } from './helpers';

interface RateResult {
  post_id: string;
  rating_count: number;
  rating_avg: number | null;
  my_rating: number;
}

const onboarded = (label: string) => createUser(label, { onboarded: true });

function textPost(user: TestUser, body: string, visibility: 'public' | 'followers' = 'public'): Promise<string> {
  return rpc<string>(user.client, 'create_post', { p_body: body, p_visibility: visibility, p_media: [], p_product_ids: [], p_intent: 'share' });
}

const rate = (user: TestUser, postId: string, rating: number) => user.client.rpc('rate_post', { p_post_id: postId, p_rating: rating });

async function postRow(postId: string) {
  return must(await adminClient.from('posts').select('rating_count, rating_avg').eq('id', postId).single()) as { rating_count: number; rating_avg: number | null };
}

describe('⭐ rate_post', () => {
  let author: TestUser;
  let post: string;
  let raters: TestUser[];

  beforeAll(async () => {
    author = await onboarded('RatingAuthor');
    raters = await Promise.all(['R1', 'R2', 'R3', 'R4', 'R5'].map(onboarded));
    post = await textPost(author, 'Une publication à noter');
  });

  it('rates, changes and withdraws; the average stays hidden below 5 ratings', async () => {
    let res = must(await rate(raters[0]!, post, 4)) as RateResult;
    expect(res).toMatchObject({ rating_count: 1, rating_avg: null, my_rating: 4 });
    res = must(await rate(raters[0]!, post, 2)) as RateResult;
    expect(res).toMatchObject({ rating_count: 1, my_rating: 2 });
    res = must(await rate(raters[0]!, post, 0)) as RateResult;
    expect(res).toMatchObject({ rating_count: 0, rating_avg: null, my_rating: 0 });
  });

  it('publishes the average from 5 genuine ratings only', async () => {
    const values = [5, 4, 4, 3];
    for (let i = 0; i < 4; i++) must(await rate(raters[i]!, post, values[i]!));
    expect(await postRow(post)).toEqual({ rating_count: 4, rating_avg: null });
    must(await rate(raters[4]!, post, 5));
    expect(await postRow(post)).toEqual({ rating_count: 5, rating_avg: 4.2 });
  });

  it('a member who did not finish onboarding does not count', async () => {
    const stranger = await createUser('NotOnboarded');
    must(await rate(stranger, post, 1));
    expect((await postRow(post)).rating_count).toBe(5);
  });

  it('rejects your own post, invalid ratings and unknown posts', async () => {
    expectError(await rate(author, post, 5), 'own_post_rating');
    expectError(await rate(raters[0]!, post, 6), 'invalid_rating');
    expectError(await rate(raters[0]!, post, -1), 'invalid_rating');
    expectError(await rate(raters[0]!, '00000000-0000-0000-0000-000000000000', 3), 'not_found');
  });

  it('a post the member cannot see is not found', async () => {
    const hidden = await textPost(author, 'Réservé aux abonnés', 'followers');
    expectError(await rate(raters[0]!, hidden, 5), 'not_found');
    await follow(raters[0]!, author);
    must(await rate(raters[0]!, hidden, 5));
  });

  it('nobody can list who rated: own rows only, no direct writes, anonymous sees nothing', async () => {
    const mine = must(await raters[0]!.client.from('post_ratings').select('user_id').eq('post_id', post)) as { user_id: string }[];
    expect(mine.map((r) => r.user_id)).toEqual([raters[0]!.id]);
    expect(must(await author.client.from('post_ratings').select('user_id').eq('post_id', post))).toEqual([]);
    expectPermissionDenied(await raters[1]!.client.from('post_ratings').insert({ post_id: post, user_id: raters[1]!.id, rating: 5 }));
    expectPermissionDenied(await anonClient().from('post_ratings').select('user_id'));
    expectPermissionDenied(await anonClient().rpc('rate_post', { p_post_id: post, p_rating: 5 }));
  });
});

describe('👁 views', () => {
  let author: TestUser;
  let viewer: TestUser;
  let post: string;

  beforeAll(async () => {
    author = await onboarded('ViewAuthor');
    viewer = await onboarded('Viewer');
    post = await textPost(author, 'Une publication vue');
  });

  it('counts one view per member and post, never the author, and only the author reads it', async () => {
    must(await viewer.client.rpc('record_post_view', { p_post_id: post }));
    must(await viewer.client.rpc('record_post_view', { p_post_id: post })); // duplicate: ignored
    must(await author.client.rpc('record_post_view', { p_post_id: post })); // own post: ignored
    const mine = must(await author.client.rpc('my_post_views', { p_post_ids: [post] })) as { post_id: string; views: number }[];
    expect(mine).toEqual([{ post_id: post, views: 1 }]);
    // Another member gets nothing for a post that is not theirs.
    expect(must(await viewer.client.rpc('my_post_views', { p_post_ids: [post] }))).toEqual([]);
  });

  it('is invisible to clients: no table access, signed-in only', async () => {
    expectPermissionDenied(await viewer.client.from('post_views').select('post_id'));
    expectPermissionDenied(await anonClient().rpc('record_post_view', { p_post_id: post }));
    expectPermissionDenied(await anonClient().rpc('my_post_views', { p_post_ids: [post] }));
  });

  it('a DÉMO account never adds a view', async () => {
    const demo = await onboarded('DemoViewer');
    must(await adminClient.from('profiles').update({ is_demo: true }).eq('id', demo.id));
    must(await demo.client.rpc('record_post_view', { p_post_id: post }));
    const mine = must(await author.client.rpc('my_post_views', { p_post_ids: [post] })) as { views: number }[];
    expect(mine[0]!.views).toBe(1);
  });

  it('a post the member cannot see is not counted', async () => {
    const hidden = await textPost(author, 'Abonnés seulement', 'followers');
    must(await viewer.client.rpc('record_post_view', { p_post_id: hidden }));
    expect(must(await author.client.rpc('my_post_views', { p_post_ids: [hidden] }))).toEqual([]);
  });
});

describe('« Apprécié » (member_appreciation)', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  async function matureRater(label: string): Promise<TestUser> {
    const u = await onboarded(label);
    must(await adminClient.from('profiles').update({ created_at: daysAgo(30) }).eq('id', u.id));
    return u;
  }

  it('counts distinct genuine members: tier 1 from 10, new accounts and low ratings excluded', async () => {
    const author = await onboarded('Liked');
    const p1 = await textPost(author, 'Première');
    const p2 = await textPost(author, 'Deuxième');
    const none = (await rpc<{ tier: number }>(author.client, 'member_appreciation', { p_user: author.id }));
    expect(none).toMatchObject({ tier: 0, key: 'none' });

    const raters: TestUser[] = [];
    for (let i = 0; i < 9; i++) raters.push(await matureRater(`Rater${i}`));
    for (const r of raters) {
      must(await rate(r, p1, 5));
      must(await rate(r, p2, 5)); // the same member twice still counts once
    }
    expect(await rpc(author.client, 'member_appreciation', { p_user: author.id })).toMatchObject({ tier: 0 });

    // Not counted: a rater under 14 days, a rating below 4.
    const fresh = await onboarded('FreshRater');
    must(await rate(fresh, p1, 5));
    const harsh = await matureRater('HarshRater');
    must(await rate(harsh, p1, 2));
    expect(await rpc(author.client, 'member_appreciation', { p_user: author.id })).toMatchObject({ tier: 0 });

    // The 10th genuine member reaches the first tier (a heart counts like a high rating).
    const hearter = await matureRater('Hearter');
    must(await hearter.client.rpc('vote_post', { p_post_id: p1, p_value: 1 }));
    expect(await rpc(author.client, 'member_appreciation', { p_user: author.id })).toEqual({ tier: 1, key: 'apprecie' });
    // Visible to anyone who may see the profile.
    expect(await rpc(anonClient(), 'member_appreciation', { p_user: author.id })).toMatchObject({ tier: 1 });
  }, 120_000);
});
