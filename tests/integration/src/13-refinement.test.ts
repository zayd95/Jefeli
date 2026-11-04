/**
 * Post-playtest refinement (supabase/migrations/20261105000100_refinement.sql):
 *   1. flexible listing prices: « Prix affiché » (fixed), « Prix sur demande » (on_request),
 *      « À discuter » (negotiable), and offers on listings without a displayed price;
 *   2. pinned posts and products (set_pinned);
 *   3. genuine upvotes: only active members who completed onboarding count;
 *   4. get_feed('for_you') v4: distinct commenters, repeated texts and repeated products sink.
 *
 * The ranking tests compare the relative order of posts created here only: the candidate pool
 * also holds other recent posts (seed data, other describes of this file).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  anonClient,
  createListing,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  hasPsql,
  listingArgs,
  must,
  psql,
  rpc,
  token,
  uploadImage,
  type Client,
  type CreateUserOptions,
  type ListingInput,
  type TestUser,
} from './helpers';

type Intent = 'share' | 'seek' | 'offer' | 'opinion';
type PriceMode = 'fixed' | 'on_request' | 'negotiable';

interface FeedRow {
  post_id: string;
  reason: string;
  score: number | null;
  created_at: string;
}

interface PgResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

function createUsers(prefix: string, labels: string[], opts: CreateUserOptions = {}): Promise<TestUser[]> {
  return Promise.all(labels.map((l) => createUser(`${prefix}-${l}`, opts)));
}

/** A CHECK constraint refused the write (Postgres 23514), naming the constraint. */
function expectCheckViolation(res: PgResult, constraint: string): void {
  expect(res.error, `expected a check violation of ${constraint}, got data ${JSON.stringify(res.data)}`).toBeTruthy();
  expect(res.error!.code).toBe('23514');
  expect(res.error!.message).toContain(constraint);
}

/** Publication through the real create_post RPC (text only, optionally tagging own products). */
function textPost(user: TestUser, body: string, intent: Intent = 'share', productIds: string[] = []): Promise<string> {
  return rpc<string>(user.client, 'create_post', {
    p_body: body,
    p_visibility: 'public',
    p_media: [],
    p_product_ids: productIds,
    p_intent: intent,
  });
}

async function comment(user: TestUser, postId: string, body: string): Promise<string> {
  const res = await user.client.from('comments').insert({ post_id: postId, author_id: user.id, body }).select('id').single();
  return (must(res, `comment by ${user.label}`) as { id: string }).id;
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** Fixture: back-dates one of our own test posts. */
async function setPostCreatedAt(postId: string, at: Date): Promise<void> {
  must(await adminClient.from('posts').update({ created_at: at.toISOString() }).eq('id', postId), 'set post created_at');
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

async function voteOk(user: TestUser, postId: string, value: number): Promise<{ upvote_count: number; my_vote: number }> {
  return must(await user.client.rpc('vote_post', { p_post_id: postId, p_value: value }), `vote by ${user.label}`) as {
    upvote_count: number;
    my_vote: number;
  };
}

/** Ground truth (service role): the vote rows of a post and its public counter. */
async function voteTruth(postId: string): Promise<{ voters: string[]; upvotes: number }> {
  const rows = must(await adminClient.from('post_votes').select('user_id').eq('post_id', postId).eq('value', 1)) as {
    user_id: string;
  }[];
  const post = must(await adminClient.from('posts').select('upvote_count').eq('id', postId).single()) as { upvote_count: number };
  return { voters: rows.map((r) => r.user_id).sort(), upvotes: post.upvote_count };
}

async function publicUpvotes(postId: string): Promise<number> {
  return (must(await anonClient().from('posts').select('upvote_count').eq('id', postId).single()) as { upvote_count: number })
    .upvote_count;
}

// ---------------------------------------------------------------------------------------
// 1. Price modes
// ---------------------------------------------------------------------------------------

describe('Price modes — create_listing', () => {
  let seller: TestUser;
  let media: string;

  beforeAll(async () => {
    [seller] = await createUsers('pm', ['seller']);
    media = await uploadImage(seller, 'public-media');
  });

  const create = (input: ListingInput) => seller.client.rpc('create_listing', listingArgs(media, input));

  async function created(input: ListingInput): Promise<{ price_xof: number | null; price_mode: string; listing_mode: string }> {
    const id = must(await create(input), `create_listing(${JSON.stringify(input)})`) as string;
    return must(
      await adminClient.from('products').select('price_xof, price_mode, listing_mode').eq('id', id).single(),
    ) as { price_xof: number | null; price_mode: string; listing_mode: string };
  }

  it("a displayed price is the default when p_price_mode is omitted or null; 'fixed' works explicitly", async () => {
    expect(await created({ price: 25000 })).toEqual({ price_xof: 25000, price_mode: 'fixed', listing_mode: 'sale' });
    expect(await created({ price: 12000, priceMode: null })).toEqual({ price_xof: 12000, price_mode: 'fixed', listing_mode: 'sale' });
    expect(await created({ price: 1, priceMode: 'fixed', mode: 'sale_or_trade' })).toEqual({
      price_xof: 1,
      price_mode: 'fixed',
      listing_mode: 'sale_or_trade',
    });
  });

  it('a displayed price is required for anything for sale (price_required); a trade-only listing may omit it', async () => {
    for (const mode of ['sale', 'sale_or_trade'] as const) {
      expectError(await create({ price: null, priceMode: 'fixed', mode }), 'price_required');
      expectError(await create({ price: null, mode }), 'price_required'); // omitted mode = fixed
    }
    expect(await created({ price: null, priceMode: 'fixed', mode: 'trade' })).toEqual({
      price_xof: null,
      price_mode: 'fixed',
      listing_mode: 'trade',
    });
  });

  it('« Prix sur demande » never stores a price, even when one is sent', async () => {
    for (const price of [50000, 1, 0, null]) {
      expect(await created({ price, priceMode: 'on_request' })).toEqual({
        price_xof: null,
        price_mode: 'on_request',
        listing_mode: 'sale',
      });
    }
    expect(await created({ price: 9000, priceMode: 'on_request', mode: 'trade' })).toMatchObject({
      price_xof: null,
      price_mode: 'on_request',
    });
  });

  it('« À discuter » takes an optional indicative price', async () => {
    expect(await created({ price: 30000, priceMode: 'negotiable' })).toEqual({
      price_xof: 30000,
      price_mode: 'negotiable',
      listing_mode: 'sale',
    });
    expect(await created({ price: null, priceMode: 'negotiable' })).toEqual({
      price_xof: null,
      price_mode: 'negotiable',
      listing_mode: 'sale',
    });
    expect(await created({ price: null, priceMode: 'negotiable', mode: 'sale_or_trade' })).toMatchObject({
      price_xof: null,
      price_mode: 'negotiable',
    });
  });

  it('a 0 F (or negative) price is refused with invalid_amount, whatever the mode that keeps a price', async () => {
    for (const priceMode of [undefined, 'fixed', 'negotiable'] as const) {
      for (const mode of ['sale', 'sale_or_trade', 'trade'] as const) {
        expectError(await create({ price: 0, priceMode, mode }), 'invalid_amount');
        expectError(await create({ price: -500, priceMode, mode }), 'invalid_amount');
      }
    }
    // Above the maximum, the table constraint refuses it.
    expectCheckViolation(await create({ price: 100_000_001, priceMode: 'negotiable' }), 'products_price_xof_check');
  });

  it('unknown price modes are refused with invalid_price_mode', async () => {
    for (const bad of ['free', 'gratuit', 'FIXED', 'on request', '', 'fixed ']) {
      expectError(await create({ price: 1000, priceMode: bad as PriceMode }), 'invalid_price_mode');
    }
  });

  it('a photo is still required (media_required), and visitors cannot create listings', async () => {
    for (const priceMode of ['fixed', 'on_request', 'negotiable'] as const) {
      expectError(
        await seller.client.rpc('create_listing', { ...listingArgs(media, { price: 1000, priceMode }), p_media: [] }),
        'media_required',
      );
    }
    expectPermissionDenied(await anonClient().rpc('create_listing', listingArgs(media, { priceMode: 'on_request' })));
  });
});

describe('Price modes — owner updates (column grant + table rules)', () => {
  let seller: TestUser;
  let other: TestUser;
  let media: string;

  beforeAll(async () => {
    [seller, other] = await createUsers('pmu', ['seller', 'other']);
    media = await uploadImage(seller, 'public-media');
  });

  const listing = (input: ListingInput) => createListing(seller, { mediaPath: media, ...input });
  const update = (id: string, values: Record<string, unknown>, as: TestUser = seller) =>
    as.client.from('products').update(values).eq('id', id).select('price_xof, price_mode');
  async function truth(id: string) {
    return must(await adminClient.from('products').select('price_xof, price_mode, listing_mode').eq('id', id).single());
  }

  it('fixed → on request: the price must be cleared in the same update', async () => {
    const id = await listing({ price: 20000 });
    expectCheckViolation(await update(id, { price_mode: 'on_request' }), 'products_price_rules');
    expectCheckViolation(await update(id, { price_mode: 'on_request', price_xof: 5000 }), 'products_price_rules');
    expect(await truth(id)).toEqual({ price_xof: 20000, price_mode: 'fixed', listing_mode: 'sale' });

    expect(must(await update(id, { price_mode: 'on_request', price_xof: null }))).toEqual([
      { price_xof: null, price_mode: 'on_request' },
    ]);
    // A price cannot be slipped back in while the listing is « sur demande ».
    expectCheckViolation(await update(id, { price_xof: 15000 }), 'products_price_rules');
    expect(await truth(id)).toMatchObject({ price_xof: null, price_mode: 'on_request' });
  });

  it('on request → fixed needs a price', async () => {
    const id = await listing({ price: null, priceMode: 'on_request' });
    expectCheckViolation(await update(id, { price_mode: 'fixed' }), 'products_price_rules');
    expectCheckViolation(await update(id, { price_mode: 'fixed', price_xof: 0 }), 'products_price_xof_check');
    expect(await truth(id)).toMatchObject({ price_xof: null, price_mode: 'on_request' });
    expect(must(await update(id, { price_mode: 'fixed', price_xof: 18000 }))).toEqual([{ price_xof: 18000, price_mode: 'fixed' }]);
    // A displayed price can no longer be removed.
    expectCheckViolation(await update(id, { price_xof: null }), 'products_price_rules');
  });

  it('negotiable: the indicative price can be added, changed or removed; never 0 F', async () => {
    const id = await listing({ price: 40000 });
    expect(must(await update(id, { price_mode: 'negotiable', price_xof: null }))).toEqual([
      { price_xof: null, price_mode: 'negotiable' },
    ]);
    expect(must(await update(id, { price_xof: 35000 }))).toEqual([{ price_xof: 35000, price_mode: 'negotiable' }]);
    expect(must(await update(id, { price_xof: null }))).toEqual([{ price_xof: null, price_mode: 'negotiable' }]);
    expectCheckViolation(await update(id, { price_xof: 0 }), 'products_price_xof_check');
    expectCheckViolation(await update(id, { price_mode: 'gratuit' }), 'products_price_mode_check');
    expect(await truth(id)).toMatchObject({ price_xof: null, price_mode: 'negotiable' });
  });

  it('a trade-only listing without a price must get one before being put up for sale', async () => {
    const id = await listing({ price: null, mode: 'trade' });
    expectCheckViolation(await update(id, { listing_mode: 'sale' }), 'products_price_rules');
    expectCheckViolation(await update(id, { listing_mode: 'sale_or_trade' }), 'products_price_rules');
    must(await update(id, { listing_mode: 'sale_or_trade', price_xof: 70000 }));
    expect(await truth(id)).toEqual({ price_xof: 70000, price_mode: 'fixed', listing_mode: 'sale_or_trade' });
    // Or it switches to « sur demande » / « à discuter » at the same time.
    const id2 = await listing({ price: null, mode: 'trade' });
    must(await update(id2, { listing_mode: 'sale', price_mode: 'on_request' }));
    expect(await truth(id2)).toEqual({ price_xof: null, price_mode: 'on_request', listing_mode: 'sale' });
  });

  it('another member cannot change the price mode (RLS: 0 rows); visitors have no UPDATE grant', async () => {
    const id = await listing({ price: 22000 });
    expectNoRowsAffected(await update(id, { price_mode: 'on_request', price_xof: null }, other));
    expectNoRowsAffected(await update(id, { price_mode: 'negotiable' }, other));
    expectPermissionDenied(await anonClient().from('products').update({ price_mode: 'negotiable' }).eq('id', id));
    expect(await truth(id)).toEqual({ price_xof: 22000, price_mode: 'fixed', listing_mode: 'sale' });
  });
});

describe('Price modes — reading and browsing', () => {
  const tok = token(10);
  let seller: TestUser;
  let viewer: TestUser;
  const ids: Record<PriceMode, string> = { fixed: '', on_request: '', negotiable: '' };

  beforeAll(async () => {
    [seller, viewer] = await createUsers('pmr', ['seller', 'viewer']);
    const media = await uploadImage(seller, 'public-media');
    ids.fixed = await createListing(seller, { mediaPath: media, title: `Pagne tissé ${tok}`, price: 15000 });
    ids.on_request = await createListing(seller, {
      mediaPath: media,
      title: `Bijou sur mesure ${tok}`,
      price: 99999, // discarded
      priceMode: 'on_request',
    });
    ids.negotiable = await createListing(seller, {
      mediaPath: media,
      title: `Table en teck ${tok}`,
      price: null,
      priceMode: 'negotiable',
    });
  });

  it('visitors and members read price_mode (and a null price) on active listings', async () => {
    for (const client of [anonClient(), viewer.client]) {
      const rows = must(
        await client.from('products').select('id, price_xof, price_mode').in('id', Object.values(ids)),
      ) as { id: string; price_xof: number | null; price_mode: string }[];
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[ids.fixed]).toEqual({ id: ids.fixed, price_xof: 15000, price_mode: 'fixed' });
      expect(byId[ids.on_request]).toEqual({ id: ids.on_request, price_xof: null, price_mode: 'on_request' });
      expect(byId[ids.negotiable]).toEqual({ id: ids.negotiable, price_xof: null, price_mode: 'negotiable' });
    }
  });

  it('browse_products returns price_mode with every listing', async () => {
    for (const client of [anonClient(), viewer.client]) {
      const rows = await rpc<any[]>(client, 'browse_products', { p_query: tok, p_limit: 50 });
      const mine = rows.filter((r) => r.seller_id === seller.id);
      expect(mine.map((r) => [r.id, r.price_mode, r.price_xof]).sort()).toEqual(
        [
          [ids.fixed, 'fixed', 15000],
          [ids.on_request, 'on_request', null],
          [ids.negotiable, 'negotiable', null],
        ].sort(),
      );
      for (const r of rows) expect(['fixed', 'on_request', 'negotiable']).toContain(r.price_mode);
    }
  });
});

describe('Price modes — offers on listings without a displayed price', () => {
  let seller: TestUser;
  let buyer: TestUser;
  let onRequest: string; // « sur demande », sale or trade
  let negotiable: string; // « à discuter » without a price
  let tradeOnRequest: string; // trade-only, « sur demande »
  let buyerItem: string;

  beforeAll(async () => {
    [seller, buyer] = await createUsers('pmo', ['seller', 'buyer']);
    const media = await uploadImage(seller, 'public-media');
    onRequest = await createListing(seller, {
      mediaPath: media,
      title: 'Boubou brodé sur mesure',
      price: null,
      priceMode: 'on_request',
      mode: 'sale_or_trade',
    });
    negotiable = await createListing(seller, { mediaPath: media, title: 'Fauteuil en rotin', price: null, priceMode: 'negotiable' });
    tradeOnRequest = await createListing(seller, {
      mediaPath: media,
      title: 'Appareil photo argentique',
      price: null,
      priceMode: 'on_request',
      mode: 'trade',
    });
    buyerItem = await createListing(buyer, { title: 'Enceinte Bluetooth', price: 30000, mode: 'sale_or_trade' });
  });

  it('a buyer makes a price offer on a « sur demande » listing; the seller accepts → agreement', async () => {
    const offerId = await rpc<string>(buyer.client, 'make_offer', {
      p_product_id: onRequest,
      p_kind: 'price',
      p_amount_xof: 40000,
      p_message: 'Quel est votre prix ? Je propose 40 000 F',
    });
    const offer = must(await seller.client.from('offers').select('*').eq('id', offerId).single()) as any;
    expect(offer).toMatchObject({ kind: 'price', amount_xof: 40000, status: 'pending', buyer_id: buyer.id, seller_id: seller.id });
    expect(offer.snapshot.product).toMatchObject({ id: onRequest, price_mode: 'on_request', listing_mode: 'sale_or_trade' });
    expect(offer.snapshot.product).toHaveProperty('price_xof', null);

    const agreementId = await rpc<string>(seller.client, 'respond_offer', { p_offer_id: offerId, p_accept: true });
    const agreement = must(await buyer.client.from('agreements').select('*').eq('id', agreementId).single()) as any;
    expect(agreement).toMatchObject({ status: 'agreed', kind: 'price', amount_xof: 40000, buyer_id: buyer.id, seller_id: seller.id });
    expect(agreement.terms.product).toMatchObject({ id: onRequest, price_mode: 'on_request' });
    expect(agreement.terms.product).toHaveProperty('price_xof', null);
    expect(agreement.terms.amount_xof).toBe(40000);
  });

  it('a price offer on a « à discuter » listing without an indicative price works the same way', async () => {
    const offerId = await rpc<string>(buyer.client, 'make_offer', { p_product_id: negotiable, p_kind: 'price', p_amount_xof: 25000 });
    const offer = must(await buyer.client.from('offers').select('snapshot, amount_xof').eq('id', offerId).single()) as any;
    expect(offer.amount_xof).toBe(25000);
    expect(offer.snapshot.product).toMatchObject({ id: negotiable, price_mode: 'negotiable', price_xof: null });
    // The seller answers with a counter-offer: the listing still has no price.
    const counter = await rpc<string>(seller.client, 'counter_offer', { p_offer_id: offerId, p_amount_xof: 32000 });
    const agreementId = await rpc<string>(buyer.client, 'respond_offer', { p_offer_id: counter, p_accept: true });
    const agreement = must(await seller.client.from('agreements').select('amount_xof, terms').eq('id', agreementId).single()) as any;
    expect(agreement.amount_xof).toBe(32000);
    expect(agreement.terms.product).toMatchObject({ price_mode: 'negotiable', price_xof: null });
  });

  it('a barter (+ cash) on a « sur demande » listing; the snapshot keeps both price modes', async () => {
    const offerId = await rpc<string>(buyer.client, 'make_offer', {
      p_product_id: tradeOnRequest,
      p_kind: 'barter',
      p_amount_xof: 5000,
      p_offered_product_id: buyerItem,
      p_cash_payer: 'buyer',
    });
    const offer = must(await seller.client.from('offers').select('*').eq('id', offerId).single()) as any;
    expect(offer).toMatchObject({ kind: 'barter', amount_xof: 5000, cash_payer: 'buyer', offered_product_id: buyerItem });
    expect(offer.snapshot.product).toMatchObject({ id: tradeOnRequest, price_mode: 'on_request', price_xof: null });
    expect(offer.snapshot.offered_product).toMatchObject({ id: buyerItem, price_mode: 'fixed', price_xof: 30000 });

    const agreementId = await rpc<string>(seller.client, 'respond_offer', { p_offer_id: offerId, p_accept: true });
    const agreement = must(await buyer.client.from('agreements').select('*').eq('id', agreementId).single()) as any;
    expect(agreement).toMatchObject({ kind: 'barter', amount_xof: 5000, product_id: tradeOnRequest, offered_product_id: buyerItem });
    expect(agreement.terms.product).toMatchObject({ price_mode: 'on_request', price_xof: null });
    expect(agreement.terms.offered_product).toMatchObject({ price_mode: 'fixed', price_xof: 30000 });
  });

  it('the usual offer rules still apply: amounts above 0 F, listing mode, own listings', async () => {
    const fresh = await createListing(seller, { title: 'Lampe en calebasse', price: null, priceMode: 'on_request' });
    for (const amount of [0, -1, null]) {
      expectError(
        await buyer.client.rpc('make_offer', { p_product_id: fresh, p_kind: 'price', p_amount_xof: amount }),
        'invalid_amount',
      );
    }
    expectError(
      await buyer.client.rpc('make_offer', { p_product_id: tradeOnRequest, p_kind: 'price', p_amount_xof: 10000 }),
      'not_for_sale',
    );
    expectError(
      await seller.client.rpc('make_offer', { p_product_id: fresh, p_kind: 'price', p_amount_xof: 10000 }),
      'own_product',
    );
  });
});

// ---------------------------------------------------------------------------------------
// 2. Pins
// ---------------------------------------------------------------------------------------

describe('Pinned posts and products (set_pinned)', () => {
  let owner: TestUser;
  let other: TestUser;
  let posts: string[];
  let products: string[];

  beforeAll(async () => {
    [owner, other] = await createUsers('pin', ['owner', 'other']);
    posts = [];
    for (let i = 1; i <= 6; i++) posts.push(await textPost(owner, `Publication épinglable ${i}`));
    const media = await uploadImage(owner, 'public-media');
    products = [];
    for (let i = 1; i <= 5; i++) products.push(await createListing(owner, { mediaPath: media, title: `Article épinglable ${i}` }));
  });

  const pin = (kind: unknown, id: string, pinned: unknown, as: Client = owner.client) =>
    as.rpc('set_pinned', { p_kind: kind, p_id: id, p_pinned: pinned });
  const pinOk = async (kind: 'post' | 'product', id: string, pinned: boolean) =>
    must(await pin(kind, id, pinned), `set_pinned(${kind}, ${pinned})`);

  async function pinnedAt(table: 'posts' | 'products', id: string, client: Client = adminClient): Promise<string | null> {
    return (must(await client.from(table).select('pinned_at').eq('id', id).single()) as { pinned_at: string | null }).pinned_at;
  }
  async function pinnedIds(table: 'posts' | 'products', column: 'author_id' | 'seller_id'): Promise<string[]> {
    const rows = must(
      await adminClient.from(table).select('id').eq(column, owner.id).not('pinned_at', 'is', null),
    ) as { id: string }[];
    return rows.map((r) => r.id).sort();
  }

  it('the owner pins and unpins a post and a product; other members and visitors see pinned_at', async () => {
    await pinOk('post', posts[0]!, true);
    await pinOk('product', products[0]!, true);
    const postPin = await pinnedAt('posts', posts[0]!);
    const productPin = await pinnedAt('products', products[0]!);
    expect(postPin).toBeTruthy();
    expect(productPin).toBeTruthy();
    for (const client of [other.client, anonClient()]) {
      expect(await pinnedAt('posts', posts[0]!, client)).toBe(postPin);
      expect(await pinnedAt('products', products[0]!, client)).toBe(productPin);
    }
    // Pinning is not an edit of the post.
    expect((must(await adminClient.from('posts').select('edited_at').eq('id', posts[0]!).single()) as any).edited_at).toBeNull();

    await pinOk('post', posts[0]!, false);
    await pinOk('product', products[0]!, false);
    for (const client of [adminClient, other.client, anonClient()]) {
      expect(await pinnedAt('posts', posts[0]!, client)).toBeNull();
      expect(await pinnedAt('products', products[0]!, client)).toBeNull();
    }
  });

  it('pinning is idempotent (the first pinned_at is kept); unpinning twice is harmless', async () => {
    await pinOk('post', posts[0]!, true);
    const first = await pinnedAt('posts', posts[0]!);
    await pinOk('post', posts[0]!, true);
    expect(await pinnedAt('posts', posts[0]!)).toBe(first);
    await pinOk('product', products[0]!, true);
    const firstProduct = await pinnedAt('products', products[0]!);
    await pinOk('product', products[0]!, true);
    expect(await pinnedAt('products', products[0]!)).toBe(firstProduct);

    await pinOk('post', posts[1]!, false); // never pinned
    await pinOk('post', posts[1]!, false);
    expect(await pinnedAt('posts', posts[1]!)).toBeNull();
    expect(await pinnedIds('posts', 'author_id')).toEqual([posts[0]!]);
    expect(await pinnedIds('products', 'seller_id')).toEqual([products[0]!]);
  });

  it('at most 3 pinned posts and 3 pinned products: the 4th is refused with pin_limit (per kind)', async () => {
    await pinOk('post', posts[1]!, true);
    await pinOk('post', posts[2]!, true);
    expectError(await pin('post', posts[3]!, true), 'pin_limit');
    // Re-pinning an already pinned post at the limit is still fine.
    await pinOk('post', posts[2]!, true);
    // The post limit does not use up product slots.
    await pinOk('product', products[1]!, true);
    await pinOk('product', products[2]!, true);
    expectError(await pin('product', products[3]!, true), 'pin_limit');
    expect(await pinnedIds('posts', 'author_id')).toEqual([posts[0]!, posts[1]!, posts[2]!].sort());
    expect(await pinnedIds('products', 'seller_id')).toEqual([products[0]!, products[1]!, products[2]!].sort());

    // Unpinning frees a slot.
    await pinOk('post', posts[1]!, false);
    await pinOk('post', posts[3]!, true);
    await pinOk('product', products[0]!, false);
    await pinOk('product', products[3]!, true);
    expect(await pinnedIds('posts', 'author_id')).toEqual([posts[0]!, posts[2]!, posts[3]!].sort());
    expect(await pinnedIds('products', 'seller_id')).toEqual([products[1]!, products[2]!, products[3]!].sort());
    expectError(await pin('post', posts[4]!, true), 'pin_limit');
    expectError(await pin('product', products[4]!, true), 'pin_limit');
  });

  it('a deleted pinned post frees its slot and can no longer be pinned', async () => {
    await rpc(owner.client, 'delete_post', { p_post_id: posts[0]! });
    await pinOk('post', posts[4]!, true);
    expectError(await pin('post', posts[0]!, true), 'not_found');
    expectError(await pin('post', posts[0]!, false), 'not_found');
    expectError(await pin('post', posts[5]!, true), 'pin_limit');
  });

  it('only the owner can pin or unpin: other members get not_found, visitors permission denied', async () => {
    const before = {
      posts: await pinnedIds('posts', 'author_id'),
      products: await pinnedIds('products', 'seller_id'),
    };
    expectError(await pin('post', posts[5]!, true, other.client), 'not_found');
    expectError(await pin('post', posts[2]!, false, other.client), 'not_found');
    expectError(await pin('product', products[4]!, true, other.client), 'not_found');
    expectError(await pin('product', products[1]!, false, other.client), 'not_found');
    expectError(await pin('post', crypto.randomUUID(), true), 'not_found');
    expectError(await pin('product', crypto.randomUUID(), true), 'not_found');
    for (const [kind, id] of [
      ['post', posts[5]!],
      ['post', posts[2]!],
      ['product', products[4]!],
    ] as const) {
      expectPermissionDenied(await pin(kind, id, true, anonClient()));
      expectPermissionDenied(await pin(kind, id, false, anonClient()));
    }
    expect(await pinnedIds('posts', 'author_id')).toEqual(before.posts);
    expect(await pinnedIds('products', 'seller_id')).toEqual(before.products);
  });

  it('unknown kinds are refused with invalid_target', async () => {
    for (const kind of ['comment', 'story', 'posts', 'POST', '', null]) {
      expectError(await pin(kind, posts[5]!, true), 'invalid_target');
    }
    expect(await pinnedAt('posts', posts[5]!)).toBeNull();
  });

  it('pinned_at has no direct write path, not even for the owner', async () => {
    const at = new Date().toISOString();
    for (const client of [owner.client, other.client]) {
      expectPermissionDenied(await client.from('posts').update({ pinned_at: at }).eq('id', posts[5]!));
      expectPermissionDenied(await client.from('posts').update({ pinned_at: null }).eq('id', posts[2]!));
      expectPermissionDenied(await client.from('products').update({ pinned_at: at }).eq('id', products[4]!));
      expectPermissionDenied(await client.from('products').update({ pinned_at: null }).eq('id', products[1]!));
    }
    expect(await pinnedAt('posts', posts[5]!)).toBeNull();
    expect(await pinnedAt('posts', posts[2]!)).toBeTruthy();
    expect(await pinnedAt('products', products[4]!)).toBeNull();
    expect(await pinnedAt('products', products[1]!)).toBeTruthy();
  });

  it.skipIf(!hasPsql())('catalog: set_pinned is not executable by anon; pinned_at is not updatable by API roles', () => {
    expect(psql(`select has_function_privilege('anon', 'public.set_pinned(text, uuid, boolean)', 'execute')`)).toBe('f');
    expect(psql(`select has_function_privilege('authenticated', 'public.set_pinned(text, uuid, boolean)', 'execute')`)).toBe('t');
    expect(
      psql(
        `select string_agg(t || ':' || r || '=' || has_column_privilege(r, 'public.' || t, 'pinned_at', 'UPDATE'), ',' order by t, r)
         from unnest(array['posts', 'products']) t, unnest(array['anon', 'authenticated']) r`,
      ),
    ).toBe('posts:anon=false,posts:authenticated=false,products:anon=false,products:authenticated=false');
  });
});

// ---------------------------------------------------------------------------------------
// 3. Genuine upvotes
// ---------------------------------------------------------------------------------------

describe('Genuine upvotes: only active members who completed onboarding count', () => {
  let author: TestUser;
  let onboarded: TestUser;
  let newcomer: TestUser; // has not completed onboarding
  let late: TestUser; // completes onboarding while suspended
  let postId: string;

  beforeAll(async () => {
    [author] = await createUsers('gu', ['author']);
    [onboarded] = await createUsers('gu', ['onboarded'], { onboarded: true });
    [newcomer, late] = await createUsers('gu', ['newcomer', 'late']);
    postId = await textPost(author, 'Mes nouveaux paniers en osier');
  });

  const setOnboarded = async (user: TestUser, at: string | null) =>
    must(await user.client.from('profiles').update({ onboarded_at: at }).eq('id', user.id), `onboarded_at for ${user.label}`);
  const setStatus = async (user: TestUser, status: 'active' | 'suspended') =>
    must(await adminClient.from('profiles').update({ status }).eq('id', user.id), `status for ${user.label}`);

  it('a vote from a member who has not completed onboarding is kept but not counted', async () => {
    expect(await voteOk(onboarded, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    expect(await voteOk(newcomer, postId, 1)).toEqual({ post_id: postId, upvote_count: 1, my_vote: 1 });
    expect(await voteTruth(postId)).toEqual({ voters: [onboarded.id, newcomer.id].sort(), upvotes: 1 });
    expect(await publicUpvotes(postId)).toBe(1);
    // The member still reads back their own vote.
    expect(must(await newcomer.client.from('post_votes').select('post_id, value'))).toEqual([{ post_id: postId, value: 1 }]);
  });

  it('completing onboarding recounts the member’s earlier upvotes (and clearing it recounts again)', async () => {
    await setOnboarded(newcomer, new Date().toISOString());
    expect(await voteTruth(postId)).toEqual({ voters: [onboarded.id, newcomer.id].sort(), upvotes: 2 });
    expect(await publicUpvotes(postId)).toBe(2);

    await setOnboarded(newcomer, null);
    expect((await voteTruth(postId)).upvotes).toBe(1);
    await setOnboarded(newcomer, new Date().toISOString());
    expect((await voteTruth(postId)).upvotes).toBe(2);
  });

  it('suspension still removes a counted vote; both conditions are needed to count', async () => {
    await setStatus(newcomer, 'suspended');
    expect(await voteTruth(postId)).toEqual({ voters: [onboarded.id, newcomer.id].sort(), upvotes: 1 });
    await setStatus(newcomer, 'active');
    expect((await voteTruth(postId)).upvotes).toBe(2);

    // Not onboarded + suspended → reactivated (still not onboarded) → onboarded while suspended
    // → reactivated: the vote counts only at the very end.
    expect((await voteOk(late, postId, 1)).upvote_count).toBe(2);
    await setStatus(late, 'suspended');
    expect((await voteTruth(postId)).upvotes).toBe(2);
    await setStatus(late, 'active');
    expect((await voteTruth(postId)).upvotes).toBe(2);
    await setStatus(late, 'suspended');
    await setOnboarded(late, new Date().toISOString());
    expect((await voteTruth(postId)).upvotes).toBe(2);
    await setStatus(late, 'active');
    expect(await voteTruth(postId)).toEqual({ voters: [onboarded.id, newcomer.id, late.id].sort(), upvotes: 3 });

    // Removing a vote and voting down still work as before for every member.
    expect((await voteOk(late, postId, -1)).upvote_count).toBe(2);
    expect((await voteOk(late, postId, 0)).upvote_count).toBe(2);
  });

  it('upvotes from members who never onboarded neither rank a post higher nor make it « popular »', async () => {
    const [a1, a2, viewer] = await createUsers('gu', ['rank-a1', 'rank-a2', 'rank-viewer']);
    const voters = await createUsers('gu', ['nv1', 'nv2', 'nv3']);
    const boosted = await textPost(a1!, 'Mes sandales en cuir de Ngaye');
    const control = await textPost(a2!, 'Mes nouvelles nattes tressées');
    await setPostCreatedAt(boosted, minutesAgo(31));
    await setPostCreatedAt(control, minutesAgo(30)); // one minute newer
    for (const v of voters) expect((await voteOk(v, boosted, 1)).my_vote).toBe(1);
    expect(await voteTruth(boosted)).toEqual({ voters: voters.map((v) => v.id).sort(), upvotes: 0 });

    for (const client of [viewer!.client, anonClient()]) {
      const rows = await feedRows(client);
      expect(rankedOrder(rows, [boosted, control])).toEqual([control, boosted]);
      expect(rowOf(rows, boosted).reason).not.toBe('popular');
    }

    for (const v of voters) await setOnboarded(v, new Date().toISOString());
    expect((await voteTruth(boosted)).upvotes).toBe(3);
    for (const client of [viewer!.client, anonClient()]) {
      const rows = await feedRows(client);
      expect(rankedOrder(rows, [control, boosted])).toEqual([boosted, control]);
      expect(rowOf(rows, boosted).reason).toBe('popular');
    }
  });
});

// ---------------------------------------------------------------------------------------
// 4. Feed ranking v4
// ---------------------------------------------------------------------------------------

describe('Feed ranking v4 (get_feed for_you)', () => {
  let viewer: TestUser; // member without relationships
  let commenters: TestUser[];

  beforeAll(async () => {
    [viewer] = await createUsers('v4', ['viewer']);
    commenters = await createUsers('v4', ['c1', 'c2', 'c3']);
  });

  const viewers = () => [viewer.client, anonClient()];

  it('comments count once per member other than the author, and only with a real message', async () => {
    const authors = await createUsers('v4', ['many', 'single', 'none-a', 'self', 'none-b', 'noise', 'none-c']);
    const [aMany, aSingle, aNoneA, aSelf, aNoneB, aNoise, aNoneC] = authors as [
      TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser,
    ];
    const [c1, c2, c3] = commenters as [TestUser, TestUser, TestUser];

    const many = await textPost(aMany, 'Mes nouveaux boubous en bazin');
    const single = await textPost(aSingle, 'Mes nouvelles robes en wax');
    const noneA = await textPost(aNoneA, 'Mes nouveaux sacs en raphia');
    const self = await textPost(aSelf, 'Mes nouvelles sandales en cuir');
    const noneB = await textPost(aNoneB, 'Mes nouveaux bracelets en perles');
    const noise = await textPost(aNoise, 'Mes nouvelles nattes en plastique');
    const noneC = await textPost(aNoneC, 'Mes nouvelles calebasses gravées');

    // Three different members vs. one member three times.
    await comment(c1, many, 'Très joli travail');
    await comment(c2, many, 'Je prends le bleu');
    await comment(c3, many, 'Disponible à Thiès ?');
    for (const body of ['Superbe', 'Toujours dispo ?', 'Je passe demain']) await comment(c1, single, body);
    // Only the author talks.
    for (const body of ['Merci à tous', 'Encore disponible', 'Livraison possible']) await comment(aSelf, self, body);
    // Too short, deleted or hidden: none of it is a real conversation.
    await comment(c1, noise, 'ok');
    await comment(c2, noise, '+1');
    await comment(c3, noise, ' 👍 ');
    const deleted = await comment(c1, noise, 'Quel est le prix ?');
    await rpc(c1.client, 'delete_comment', { p_comment_id: deleted });
    const hidden = await comment(c2, noise, 'Envoyez-moi un message');
    must(await adminClient.from('comments').update({ moderation_status: 'hidden' }).eq('id', hidden));

    // Each comparison pairs a post with a control one minute newer (which wins on recency alone).
    await setPostCreatedAt(many, minutesAgo(62));
    await setPostCreatedAt(single, minutesAgo(61));
    await setPostCreatedAt(noneA, minutesAgo(60));
    await setPostCreatedAt(self, minutesAgo(91));
    await setPostCreatedAt(noneB, minutesAgo(90));
    await setPostCreatedAt(noise, minutesAgo(121));
    await setPostCreatedAt(noneC, minutesAgo(120));

    // The public counters are unchanged: every visible comment still counts there.
    const counts = must(await adminClient.from('posts').select('id, comment_count').in('id', [many, single, self, noise])) as {
      id: string;
      comment_count: number;
    }[];
    expect(Object.fromEntries(counts.map((r) => [r.id, r.comment_count]))).toEqual({
      [many]: 3,
      [single]: 3,
      [self]: 3,
      [noise]: 3,
    });

    for (const client of viewers()) {
      const rows = await feedRows(client);
      // Three different members beat three comments by one member, which beat none.
      expect(rankedOrder(rows, [noneA, single, many])).toEqual([many, single, noneA]);
      // The author's own replies add nothing.
      expect(rankedOrder(rows, [self, noneB])).toEqual([noneB, self]);
      // Neither do one- or two-character comments, deleted or hidden ones.
      expect(rankedOrder(rows, [noise, noneC])).toEqual([noneC, noise]);
      for (const id of [many, single, noneA, self, noneB, noise, noneC]) expect(rowOf(rows, id).score).toBeNull();
    }
  });

  it('needs_answers counts the different members who really answered', async () => {
    const authors = await createUsers('v4', ['seek-one', 'seek-three', 'seek-self', 'seek-short']);
    const [aOne, aThree, aSelf, aShort] = authors as [TestUser, TestUser, TestUser, TestUser];
    const [c1, c2, c3] = commenters as [TestUser, TestUser, TestUser];

    const oneMember = await textPost(aOne, 'Je cherche un tailleur à Rufisque', 'seek');
    const threeMembers = await textPost(aThree, 'Je cherche un cordonnier à Pikine', 'seek');
    const withSelf = await textPost(aSelf, 'Votre avis : wax ou bazin pour un mariage ?', 'opinion');
    const withShort = await textPost(aShort, 'Je cherche une couturière à Mbour', 'seek');

    for (const body of ['Au marché HLM', 'Ou à Colobane', 'Demandez à Moussa']) await comment(c1, oneMember, body);
    await comment(c1, threeMembers, 'Au marché Tilène');
    await comment(c2, threeMembers, 'Essayez à Thiaroye');
    await comment(c3, threeMembers, 'Mon voisin répare tout');
    await comment(c1, withSelf, 'Le bazin, sans hésiter');
    await comment(c2, withSelf, 'Le wax pour la fête');
    await comment(aSelf, withSelf, 'Merci, et pour le soir ?');
    await comment(aSelf, withSelf, 'Encore d’autres avis ?');
    await comment(c1, withShort, 'Au quartier Escale');
    await comment(c2, withShort, 'Chez Awa, à côté du marché');
    await comment(c3, withShort, 'ok');

    const rows = await feedRows(viewer.client);
    expect(rowOf(rows, oneMember).reason).toBe('needs_answers');
    expect(rowOf(rows, threeMembers).reason).toBe('new_seller'); // answered by three members
    expect(rowOf(rows, withSelf).reason).toBe('needs_answers');
    expect(rowOf(rows, withShort).reason).toBe('needs_answers');
    const anonRows = await feedRows(anonClient());
    expect(rowOf(anonRows, oneMember).reason).toBe('needs_answers');
    expect(rowOf(anonRows, threeMembers).reason).not.toBe('needs_answers');
  });

  it('the same text published again by its author sinks; the first copy keeps its place', async () => {
    const authors = await createUsers('v4', ['copier', 'control', 'echo', 'echo-ctrl', 'short', 'short-ctrl']);
    const [copier, control, echo, echoCtrl, short, shortCtrl] = authors as [
      TestUser, TestUser, TestUser, TestUser, TestUser, TestUser,
    ];
    const text = 'Robe en wax à vendre, taille M, très bon état';

    const first = await textPost(copier, text);
    const copy = await textPost(copier, 'ROBE EN WAX A VENDRE, taille m, tres bon etat'); // same text, normalised
    // The control author also published twice (different texts), so author diversity is equal.
    const ctrlFirst = await textPost(control, 'Chaussures en cuir faites main à Ngor');
    const ctrlSecond = await textPost(control, 'Nouveau stock de bazin riche, toutes couleurs');
    // Another member publishing the same text is not a repeat of theirs.
    const echoed = await textPost(echo, text);
    const echoControl = await textPost(echoCtrl, 'Sacs tressés en raphia, plusieurs coloris');
    // Short texts (< 12 characters) are never treated as copies.
    const short1 = await textPost(short, 'Dispo !');
    const short2 = await textPost(short, 'Dispo !');
    const shortCtrl1 = await textPost(shortCtrl, 'Merci !');
    const shortCtrl2 = await textPost(shortCtrl, 'Bonjour');

    // Each post is one minute newer than its control (it would win on recency alone).
    await setPostCreatedAt(first, minutesAgo(40));
    await setPostCreatedAt(ctrlFirst, minutesAgo(41));
    await setPostCreatedAt(copy, minutesAgo(20));
    await setPostCreatedAt(ctrlSecond, minutesAgo(21));
    await setPostCreatedAt(echoed, minutesAgo(25));
    await setPostCreatedAt(echoControl, minutesAgo(26));
    await setPostCreatedAt(short1, minutesAgo(50));
    await setPostCreatedAt(shortCtrl1, minutesAgo(51));
    await setPostCreatedAt(short2, minutesAgo(30));
    await setPostCreatedAt(shortCtrl2, minutesAgo(31));

    for (const client of viewers()) {
      const rows = await feedRows(client);
      expect(rankedOrder(rows, [copy, ctrlSecond])).toEqual([ctrlSecond, copy]);
      expect(rankedOrder(rows, [ctrlFirst, first])).toEqual([first, ctrlFirst]);
      expect(rankedOrder(rows, [echoControl, echoed])).toEqual([echoed, echoControl]);
      expect(rankedOrder(rows, [shortCtrl2, short2])).toEqual([short2, shortCtrl2]);
      expect(rankedOrder(rows, [shortCtrl1, short1])).toEqual([short1, shortCtrl1]);
    }
  });

  it('a later post tagging the same product sinks by at least 1.5 (vs. an equivalent control)', async () => {
    const [repeater, varied, control] = await createUsers('v4', ['prod-repeat', 'prod-varied', 'prod-control']);
    const fillers = await createUsers('v4', ['fill-1', 'fill-2', 'fill-3', 'fill-4']);
    const product = await createListing(repeater!, { title: 'Ventilateur sur pied' });
    const [v1, v2] = [
      await createListing(varied!, { title: 'Radio portable' }),
      await createListing(varied!, { title: 'Lampe de chevet' }),
    ];
    const [k1, k2] = [
      await createListing(control!, { title: 'Bouilloire électrique' }),
      await createListing(control!, { title: 'Fer à repasser' }),
    ];

    const p1 = await textPost(repeater!, 'Ventilateur disponible, livraison à Dakar', 'share', [product]);
    const p2 = await textPost(repeater!, 'Toujours là : venez le voir au marché', 'share', [product]);
    const q1 = await textPost(varied!, 'Radio neuve, très bon son', 'share', [v1]);
    const q2 = await textPost(varied!, 'Lampe de chevet en bois sculpté', 'share', [v2]);
    const c1 = await textPost(control!, 'Bouilloire 1,7 L, garantie', 'share', [k1]);
    const c2 = await textPost(control!, 'Fer à repasser vapeur', 'share', [k2]);
    // Four fresh product posts that outrank all of the above put each of them past the
    // capped type-diversity penalty (0.2 × 4), so only recency and the repeat rule differ.
    for (const [i, f] of fillers.entries()) {
      const item = await createListing(f, { title: `Article du jour ${i + 1}` });
      await textPost(f, `Arrivage du jour numéro ${i + 1}`, 'share', [item]);
    }

    await setPostCreatedAt(p1, minutesAgo(120));
    await setPostCreatedAt(p2, minutesAgo(60));
    await setPostCreatedAt(q1, minutesAgo(121));
    await setPostCreatedAt(q2, minutesAgo(61));
    // The control is 26.5 hours older than p2: recency (1 point per 18 h) favours p2 by 1.47.
    await setPostCreatedAt(c2, minutesAgo(60 + 26.5 * 60));
    await setPostCreatedAt(c1, minutesAgo(60 + 27.5 * 60));

    for (const client of viewers()) {
      const rows = await feedRows(client);
      // p2 differs from q2 only by tagging the product again.
      expect(rankedOrder(rows, [p2, q2])).toEqual([q2, p2]);
      // …and sinks below a post 26.5 hours older: the repeat costs more than 1.47.
      expect(rankedOrder(rows, [p2, c2, q2])).toEqual([q2, c2, p2]);
      // The first post with that product keeps its place.
      expect(rankedOrder(rows, [q1, p1])).toEqual([p1, q1]);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Defense in depth
// ---------------------------------------------------------------------------------------

describe('private functions touched by the refinement migration', () => {
  it.skipIf(!hasPsql())('are not executable by anon or authenticated', () => {
    const exposed = psql(
      `select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and p.proname in ('product_snapshot', 'refresh_post_counters', 'profiles_status_recount_votes')
         and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`,
    );
    expect(exposed).toBe('');
  });
});
