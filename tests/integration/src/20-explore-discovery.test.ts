/**
 * Explorer discovery (supabase/migrations/20261113000100_explore_discovery.sql):
 *   1. explore_products: browse filters plus price range, sale / Wecci and sort order;
 *   2. trending_products: real favourites of the last days, distinct members, the seller's own
 *      save never counts, nothing revealed about who saved;
 *   3. suggested_sellers: active sellers the viewer does not follow, without blocked, muted or
 *      private accounts, public fields only.
 * Trending and suggestions compare only rows created here (seed data may also rank).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient, createListing, createUser, expectPermissionDenied, must, rpc, token, type TestUser } from './helpers';

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('explore_products: filters and sort', () => {
  const tok = `expl${token(6)}`;
  let S: TestUser;
  let cheap: string;
  let mid: string;
  let dear: string;
  let wecci: string;
  let onRequest: string;

  beforeAll(async () => {
    S = await createUser('ExploreSeller', { onboarded: true });
    cheap = await createListing(S, { title: `Sandales ${tok} a`, price: 5000 });
    mid = await createListing(S, { title: `Sandales ${tok} b`, price: 15000, mode: 'sale_or_trade' });
    dear = await createListing(S, { title: `Sandales ${tok} c`, price: 40000 });
    wecci = await createListing(S, { title: `Sandales ${tok} d`, price: null, mode: 'trade' });
    onRequest = await createListing(S, { title: `Sandales ${tok} e`, price: null, priceMode: 'on_request' });
  });

  it('price range keeps only articles with a shown price inside it', async () => {
    const V = await createUser('ExploreViewer');
    const rows = await rpc<any[]>(V.client, 'explore_products', { p_query: tok, p_min_price: 10000, p_max_price: 40000 });
    expect(ids(rows).sort()).toEqual([mid, dear].sort());
  });

  it('sorts by price both ways, articles without a price last', async () => {
    const V = await createUser('ExploreViewer2');
    const asc = ids(await rpc<any[]>(V.client, 'explore_products', { p_query: tok, p_sort: 'price_asc' }));
    expect(asc.slice(0, 3)).toEqual([cheap, mid, dear]);
    expect(asc.slice(3).sort()).toEqual([wecci, onRequest].sort());
    const desc = ids(await rpc<any[]>(V.client, 'explore_products', { p_query: tok, p_sort: 'price_desc' }));
    expect(desc.slice(0, 3)).toEqual([dear, mid, cheap]);
  });

  it('sale / Wecci filter follows the listing mode (« Les deux » in both)', async () => {
    const V = await createUser('ExploreViewer3');
    const trade = ids(await rpc<any[]>(V.client, 'explore_products', { p_query: tok, p_offer: 'trade' }));
    expect(trade.sort()).toEqual([mid, wecci].sort());
    const sale = ids(await rpc<any[]>(V.client, 'explore_products', { p_query: tok, p_offer: 'sale' }));
    expect(sale).not.toContain(wecci);
    expect(sale).toContain(mid);
  });

  it('keeps browse visibility: a blocked seller disappears', async () => {
    const V = await createUser('ExploreBlocker');
    must(await V.client.from('blocks').insert({ blocker_id: V.id, blocked_id: S.id }));
    expect(await rpc<any[]>(V.client, 'explore_products', { p_query: tok })).toHaveLength(0);
  });
});

describe('trending_products: real favourites only', () => {
  let S: TestUser;
  let hot: string;
  let warm: string;
  let V: TestUser;

  beforeAll(async () => {
    S = await createUser('TrendSeller', { onboarded: true });
    hot = await createListing(S, { title: `Tendance ${token(6)} chaud` });
    warm = await createListing(S, { title: `Tendance ${token(6)} tiède` });
    const [b1, b2] = await Promise.all([createUser('Saver1'), createUser('Saver2')]);
    must(await b1.client.from('product_saves').insert({ user_id: b1.id, product_id: hot }));
    must(await b2.client.from('product_saves').insert({ user_id: b2.id, product_id: hot }));
    must(await b1.client.from('product_saves').insert({ user_id: b1.id, product_id: warm }));
    // The seller's own saves never count.
    must(await S.client.from('product_saves').insert({ user_id: S.id, product_id: warm }));
    V = await createUser('TrendViewer');
  });

  it('ranks by distinct members who saved, and returns article rows only', async () => {
    const rows = await rpc<any[]>(V.client, 'trending_products', { p_limit: 20 });
    const list = ids(rows);
    expect(list).toContain(hot);
    expect(list).toContain(warm);
    expect(list.indexOf(hot)).toBeLessThan(list.indexOf(warm));
    expect(Object.keys(rows[0])).not.toContain('savers');
    expect(Object.keys(rows[0])).not.toContain('user_id');
  });

  it('an article nobody else saved is not trending', async () => {
    const lonely = await createListing(S, { title: `Tendance ${token(6)} seul` });
    must(await S.client.from('product_saves').insert({ user_id: S.id, product_id: lonely }));
    expect(ids(await rpc<any[]>(V.client, 'trending_products', { p_limit: 20 }))).not.toContain(lonely);
  });

  it('respects blocks and mutes, and refuses anonymous callers', async () => {
    const B = await createUser('TrendBlocker');
    must(await B.client.from('blocks').insert({ blocker_id: B.id, blocked_id: S.id }));
    expect(ids(await rpc<any[]>(B.client, 'trending_products', { p_limit: 20 }))).not.toContain(hot);
    const M = await createUser('TrendMuter');
    must(await M.client.from('mutes').insert({ muter_id: M.id, muted_id: S.id }));
    expect(ids(await rpc<any[]>(M.client, 'trending_products', { p_limit: 20 }))).not.toContain(hot);
    expectPermissionDenied(await anonClient().rpc('trending_products', {}));
  });

  it('never returns a moderated article, a sold one or one from a suspended seller', async () => {
    const S2 = await createUser('TrendSeller2', { onboarded: true });
    const [hidden, sold, fromSuspended] = await Promise.all([
      createListing(S, { title: `Tendance ${token(6)} masqué` }),
      createListing(S, { title: `Tendance ${token(6)} vendu` }),
      createListing(S2, { title: `Tendance ${token(6)} suspendu` }),
    ]);
    const savers = await Promise.all([createUser('Saver3'), createUser('Saver4')]);
    for (const b of savers) {
      for (const id of [hidden, sold, fromSuspended]) must(await b.client.from('product_saves').insert({ user_id: b.id, product_id: id }));
    }
    const before = ids(await rpc<any[]>(V.client, 'trending_products', { p_limit: 20 }));
    expect(before).toEqual(expect.arrayContaining([hidden, sold, fromSuspended]));
    must(await adminClient.from('products').update({ moderation_status: 'hidden' }).eq('id', hidden));
    must(await adminClient.from('products').update({ status: 'sold' }).eq('id', sold));
    must(await adminClient.from('profiles').update({ status: 'suspended' }).eq('id', S2.id));
    const after = ids(await rpc<any[]>(V.client, 'trending_products', { p_limit: 20 }));
    expect(after).not.toContain(hidden);
    expect(after).not.toContain(sold);
    expect(after).not.toContain(fromSuspended);
  });

  it('a private seller trends only for viewers allowed to see their content', async () => {
    const P = await createUser('TrendPrivate', { onboarded: true, profile: { is_private: true } });
    const item = await createListing(P, { title: `Tendance ${token(6)} privé` });
    // Saved by members allowed to see it (inserted directly: they would be approved followers).
    const savers = await Promise.all([createUser('Saver5'), createUser('Saver6')]);
    for (const b of savers) must(await adminClient.from('product_saves').insert({ user_id: b.id, product_id: item }));
    expect(ids(await rpc<any[]>(P.client, 'trending_products', { p_limit: 20 }))).not.toContain(item); // own article
    expect(ids(await rpc<any[]>(V.client, 'trending_products', { p_limit: 20 }))).not.toContain(item);
  });
});

describe('suggested_sellers: real sellers to follow', () => {
  let S: TestUser;
  let P: TestUser;
  let N: TestUser;

  beforeAll(async () => {
    S = await createUser('SuggestSeller', { onboarded: true, profile: { city: 'Thiès' } });
    await createListing(S, { title: `Suggestion ${token(6)}` });
    P = await createUser('SuggestPrivate', { onboarded: true, profile: { is_private: true } });
    await createListing(P, { title: `Suggestion privée ${token(6)}` });
    N = await createUser('SuggestNoListing', { onboarded: true });
  });

  it('suggests active sellers, public fields only, never private accounts or members without articles', async () => {
    const V = await createUser('SuggestViewer', { onboarded: true, profile: { city: 'Thiès' } });
    const rows = await rpc<any[]>(V.client, 'suggested_sellers', { p_limit: 20 });
    const list = ids(rows);
    expect(list).toContain(S.id);
    expect(list).not.toContain(P.id);
    expect(list).not.toContain(N.id);
    expect(list).not.toContain(V.id);
    const row = rows.find((r) => r.id === S.id);
    expect(row.active_products).toBeGreaterThanOrEqual(1);
    expect(Object.keys(row).sort()).toEqual(
      ['active_products', 'avatar_path', 'boutique_name', 'city', 'display_name', 'handle', 'id', 'is_demo', 'verification_level'].sort(),
    );
  });

  it('drops a seller once followed, blocked or muted; refuses anonymous callers', async () => {
    const F = await createUser('SuggestFollower', { onboarded: true });
    must(await F.client.from('follows').insert({ follower_id: F.id, followee_id: S.id }));
    expect(ids(await rpc<any[]>(F.client, 'suggested_sellers', { p_limit: 20 }))).not.toContain(S.id);
    const B = await createUser('SuggestBlocker', { onboarded: true });
    must(await B.client.from('blocks').insert({ blocker_id: B.id, blocked_id: S.id }));
    expect(ids(await rpc<any[]>(B.client, 'suggested_sellers', { p_limit: 20 }))).not.toContain(S.id);
    const M = await createUser('SuggestMuter', { onboarded: true });
    must(await M.client.from('mutes').insert({ muter_id: M.id, muted_id: S.id }));
    expect(ids(await rpc<any[]>(M.client, 'suggested_sellers', { p_limit: 20 }))).not.toContain(S.id);
    expectPermissionDenied(await anonClient().rpc('suggested_sellers', {}));
  });

  it('drops suspended sellers and does not count moderated articles', async () => {
    const city = `Ville ${token(6)}`; // same city: ranked first among many local sellers
    const T = await createUser('SuggestSuspended', { onboarded: true, profile: { city } });
    await createListing(T, { title: `Suggestion ${token(6)} suspendue` });
    const M = await createUser('SuggestModerated', { onboarded: true, profile: { city } });
    const only = await createListing(M, { title: `Suggestion ${token(6)} masquée` });
    const V = await createUser('SuggestViewer2', { onboarded: true, profile: { city } });
    const before = ids(await rpc<any[]>(V.client, 'suggested_sellers', { p_limit: 20 }));
    expect(before).toEqual(expect.arrayContaining([T.id, M.id]));
    must(await adminClient.from('profiles').update({ status: 'suspended' }).eq('id', T.id));
    must(await adminClient.from('products').update({ moderation_status: 'hidden' }).eq('id', only));
    const after = ids(await rpc<any[]>(V.client, 'suggested_sellers', { p_limit: 20 }));
    expect(after).not.toContain(T.id);
    expect(after).not.toContain(M.id);
  });
});
