/**
 * P1 adversarial reliability: the failure conditions a real pilot hits that the earlier suites do
 * not cover — double taps, races, stale or expired offers, sold items, edits after acceptance,
 * blocks after an agreement, deleted/private content, storage limits and session recovery.
 * Every test asserts the safe outcome; none relaxes an existing rule.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import {
  adminClient,
  anonClient,
  createListing,
  createPost,
  createUser,
  expectError,
  follow,
  must,
  rpc,
  uploadImage,
  type TestUser,
} from './helpers';

const offerArgs = (productId: string, amount: number) => ({ p_product_id: productId, p_kind: 'price', p_amount_xof: amount });

type Row = Record<string, any>;
const rowsOf = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

async function pendingOffers(productId: string, buyerId: string) {
  return rowsOf(must(await adminClient.from('offers').select('id').eq('product_id', productId).eq('buyer_id', buyerId).eq('status', 'pending')));
}

async function agreementsFor(offerId: string) {
  return rowsOf(must(await adminClient.from('agreements').select('id, terms, amount_xof, product_id').eq('offer_id', offerId)));
}

describe('P1 adversarial — offers and agreements under races and stale state', () => {
  let A: TestUser; // buyer
  let B: TestUser; // seller
  let acceptedOffer: string;
  let acceptedProduct: string;

  beforeAll(async () => {
    [A, B] = await Promise.all([createUser('A', { onboarded: true }), createUser('B', { onboarded: true })]);
  });

  it('a triple tap on « Envoyer la proposition » creates exactly one pending offer', async () => {
    const productId = await createListing(B, { title: 'Ventilateur sur pied', price: 30000 });
    const results = await Promise.all([1, 2, 3].map(() => A.client.rpc('make_offer', offerArgs(productId, 25000))));
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(2);
    // Each rejected tap reports the duplicate, either through the RPC check or the unique index.
    for (const r of failed) expect(`${r.error?.message}`).toMatch(/offer_pending|offers_one_pending_per_pair/);
    expect(await pendingOffers(productId, A.id)).toHaveLength(1);
    const offerMessages = must(await adminClient.from('messages').select('id').eq('product_id', productId).eq('kind', 'offer'));
    expect(offerMessages).toHaveLength(1);
  });

  it('two simultaneous acceptances record exactly one agreement', async () => {
    acceptedProduct = await createListing(B, { title: 'Table basse en bois', price: 60000 });
    acceptedOffer = await rpc<string>(A.client, 'make_offer', offerArgs(acceptedProduct, 55000));
    const results = await Promise.all([1, 2].map(() => B.client.rpc('respond_offer', { p_offer_id: acceptedOffer, p_accept: true })));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const loser = results.find((r) => r.error);
    expect(`${loser?.error?.message}`).toMatch(/invalid_transition/);
    expect(await agreementsFor(acceptedOffer)).toHaveLength(1);
  });

  it('a countered (stale) offer can no longer be accepted by either side', async () => {
    const productId = await createListing(B, { title: 'Chaise pliante', price: 8000 });
    const original = await rpc<string>(A.client, 'make_offer', offerArgs(productId, 5000));
    const counter = await rpc<string>(B.client, 'counter_offer', { p_offer_id: original, p_amount_xof: 7000 });
    expectError(await B.client.rpc('respond_offer', { p_offer_id: original, p_accept: true }), /invalid_transition|not_allowed/);
    expectError(await A.client.rpc('respond_offer', { p_offer_id: original, p_accept: true }), /invalid_transition|not_allowed/);
    expect(await agreementsFor(original)).toHaveLength(0);
    // The live counter-offer is still accepted normally.
    const agreementId = await rpc<string>(A.client, 'respond_offer', { p_offer_id: counter, p_accept: true });
    expect(agreementId).toBeTruthy();
  });

  it('an offer past its expiry is refused even before the expiry job has run', async () => {
    const productId = await createListing(B, { title: 'Lampe de bureau', price: 9000 });
    const offerId = await rpc<string>(A.client, 'make_offer', offerArgs(productId, 7000));
    must(await adminClient.from('offers').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', offerId));
    expectError(await B.client.rpc('respond_offer', { p_offer_id: offerId, p_accept: true }), 'offer_expired');
    expect(await agreementsFor(offerId)).toHaveLength(0);
  });

  it('an offer cannot be accepted once the item is no longer available', async () => {
    const productId = await createListing(B, { title: 'Sac de voyage', price: 15000 });
    const offerId = await rpc<string>(A.client, 'make_offer', offerArgs(productId, 12000));
    must(await B.client.from('products').update({ status: 'sold' }).eq('id', productId).select('id'));
    expectError(await B.client.rpc('respond_offer', { p_offer_id: offerId, p_accept: true }), 'product_unavailable');
    expect(await agreementsFor(offerId)).toHaveLength(0);
  });

  it('accepted terms stay immutable when the seller edits, then deletes, the product', async () => {
    const [before] = await agreementsFor(acceptedOffer);
    expect(before?.terms?.product?.title).toBe('Table basse en bois');
    expect(before?.amount_xof).toBe(55000);

    must(await B.client.from('products').update({ title: 'Table basse (modifiée)', price_xof: 99000 }).eq('id', acceptedProduct).select('id'));
    const [afterEdit] = await agreementsFor(acceptedOffer);
    expect(afterEdit?.terms).toEqual(before?.terms);
    expect(afterEdit?.amount_xof).toBe(55000);

    must(await B.client.from('products').delete().eq('id', acceptedProduct).select('id'));
    const [afterDelete] = await agreementsFor(acceptedOffer);
    expect(afterDelete?.terms).toEqual(before?.terms);
    expect(afterDelete?.product_id).toBeNull();
    // Both members still read their record; its terms cannot be rewritten by either of them.
    for (const u of [A, B]) {
      const rows = rowsOf(must(await u.client.from('agreements').select('id, terms').eq('offer_id', acceptedOffer)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.terms).toEqual(before?.terms);
    }
    const tamper = await B.client.from('agreements').update({ amount_xof: 1 }).eq('offer_id', acceptedOffer).select('id');
    expect(tamper.error || (tamper.data ?? []).length === 0).toBeTruthy();
    expect((await agreementsFor(acceptedOffer))[0]?.amount_xof).toBe(55000);
  });
});

describe('P1 adversarial — double tap on « Message »', () => {
  it('opening the same conversation three times at once never fails and yields one conversation', async () => {
    const [x, y] = await Promise.all([createUser('tapX', { onboarded: true }), createUser('tapY', { onboarded: true })]);
    const results = await Promise.all([1, 2, 3].map(() => x.client.rpc('get_or_create_conversation', { p_other: y.id })));
    const errors = results.filter((r) => r.error).map((r) => `${r.error?.code} ${r.error?.message}`);
    expect(errors, 'concurrent opens surfaced an error').toEqual([]);
    expect(new Set(results.map((r) => r.data)).size).toBe(1);
  });
});

describe('P1 adversarial — blocking after a conversation and an agreement', () => {
  let buyer: TestUser;
  let seller: TestUser;
  let conversationId: string;
  let offerId: string;
  let otherProduct: string;

  beforeAll(async () => {
    [buyer, seller] = await Promise.all([createUser('blkBuyer', { onboarded: true }), createUser('blkSeller', { onboarded: true })]);
    const productId = await createListing(seller, { title: 'Tabouret tressé', price: 10000 });
    otherProduct = await createListing(seller, { title: 'Panier tressé', price: 6000 });
    offerId = await rpc<string>(buyer.client, 'make_offer', offerArgs(productId, 9000));
    await rpc<string>(seller.client, 'respond_offer', { p_offer_id: offerId, p_accept: true });
    const offer = must(await adminClient.from('offers').select('conversation_id').eq('id', offerId).single()) as { conversation_id: string };
    conversationId = offer.conversation_id;
    must(await buyer.client.from('blocks').insert({ blocker_id: buyer.id, blocked_id: seller.id }));
  });

  it('neither side can keep messaging in the existing conversation', async () => {
    for (const [from, label] of [
      [seller, 'blocked member'],
      [buyer, 'blocker'],
    ] as const) {
      const res = await from.client.from('messages').insert({ conversation_id: conversationId, sender_id: from.id, kind: 'text', body: `Toujours là ? (${label})` }).select('id');
      expect(res.error, `${label} could still write`).toBeTruthy();
    }
  });

  it('no new offer can be made across the block', async () => {
    expectError(await buyer.client.rpc('make_offer', offerArgs(otherProduct, 5000)), /blocked|not_found/);
  });

  it('the recorded agreement stays readable by both, unchanged', async () => {
    for (const u of [buyer, seller]) {
      const rows = rowsOf(must(await u.client.from('agreements').select('id, amount_xof').eq('offer_id', offerId)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.amount_xof).toBe(9000);
    }
  });
});

describe('P1 adversarial — deleted and private content', () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createUser('owner', { onboarded: true }), createUser('stranger', { onboarded: true })]);
  });

  it('a deleted listing is gone for everyone: by id, in search, for offers', async () => {
    const title = `Radio vintage ${randomBytes(3).toString('hex')}`;
    const productId = await createListing(owner, { title, price: 20000 });
    must(await owner.client.from('products').delete().eq('id', productId).select('id'));
    expect(must(await stranger.client.from('products').select('id').eq('id', productId))).toHaveLength(0);
    expect(must(await anonClient().from('products').select('id').eq('id', productId))).toHaveLength(0);
    const found = must(await stranger.client.rpc('browse_products', { p_mode: 'recent', p_query: title, p_limit: 20, p_offset: 0 }).select('id')) as { id: string }[];
    expect(found.map((r) => r.id)).not.toContain(productId);
    expectError(await stranger.client.rpc('make_offer', offerArgs(productId, 10000)), 'not_found');
  });

  it('a deleted post is gone for other members and logged-out visitors', async () => {
    const post = await createPost(owner, 'public', 'Publication bientôt supprimée');
    const postId = post.id;
    must(await owner.client.rpc('delete_post', { p_post_id: postId }));
    for (const client of [stranger.client, anonClient()]) {
      const rows = must(await client.from('posts').select('id').eq('id', postId).is('deleted_at', null));
      expect(rows).toHaveLength(0);
    }
  });

  it('a private account’s listing stays hidden from non-followers, even by id', async () => {
    const priv = await createUser('private', { onboarded: true });
    must(await priv.client.from('profiles').update({ is_private: true }).eq('id', priv.id).select('id'));
    const productId = await createListing(priv, { title: 'Article de compte privé', price: 5000 });
    expect(must(await stranger.client.from('products').select('id').eq('id', productId))).toHaveLength(0);
    expect(must(await anonClient().from('products').select('id').eq('id', productId))).toHaveLength(0);
    expectError(await stranger.client.rpc('make_offer', offerArgs(productId, 4000)), 'not_found');
    // A pending follow request does not open it either.
    await follow(stranger, priv);
    expect(must(await stranger.client.from('products').select('id').eq('id', productId))).toHaveLength(0);
  });
});

describe('P1 adversarial — invalid and oversized media', () => {
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    [user, other] = await Promise.all([createUser('media', { onboarded: true }), createUser('mediaOther', { onboarded: true })]);
  });

  it('an avatar over the 5 MB bucket limit is refused', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 64 * 1024, 0xff);
    const res = await user.client.storage.from('avatars').upload(`${user.id}/too-big.jpg`, big, { contentType: 'image/jpeg' });
    expect(res.error).toBeTruthy();
  });

  it('a non-media file type is refused by every bucket', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    for (const bucket of ['avatars', 'public-media', 'private-media'] as const) {
      const res = await user.client.storage.from(bucket).upload(`${user.id}/posts/page.html`, html, { contentType: 'text/html' });
      expect(res.error, `${bucket} accepted text/html`).toBeTruthy();
    }
  });

  it('nobody can write into, or overwrite, another member’s files', async () => {
    const theirs = await uploadImage(other, 'public-media');
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const intoFolder = await user.client.storage.from('public-media').upload(`${other.id}/posts/intrus.png`, png, { contentType: 'image/png' });
    expect(intoFolder.error).toBeTruthy();
    const overwrite = await user.client.storage.from('public-media').upload(theirs, png, { contentType: 'image/png', upsert: true });
    expect(overwrite.error).toBeTruthy();
    const removal = await user.client.storage.from('public-media').remove([theirs]);
    // Storage answers removal of someone else's object with an empty list, never deleting it.
    expect(removal.error || (removal.data ?? []).length === 0).toBeTruthy();
    expect((await other.client.storage.from('public-media').download(theirs)).error).toBeNull();
  });
});

describe('P1 adversarial — sessions: forged tokens, refresh and sign-out', () => {
  const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');
  function forgedToken(sub: string, expiresInSec: number): string {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = b64url(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now - 7200, exp: now + expiresInSec }));
    // Signed with a key the server does not hold: must never be accepted.
    const sig = createHmac('sha256', randomBytes(32)).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  async function settingsWith(tokenValue: string, userId: string) {
    return fetch(`${SUPABASE_URL}/rest/v1/account_settings?user_id=eq.${userId}&select=user_id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tokenValue}` },
    });
  }

  it('forged and expired access tokens are rejected and return no private data', async () => {
    const victim = await createUser('victim', { onboarded: true });
    for (const t of [forgedToken(victim.id, 3600), forgedToken(victim.id, -60), 'not-a-jwt']) {
      const res = await settingsWith(t, victim.id);
      expect(res.status).toBe(401);
    }
    const genuine = await settingsWith(victim.accessToken, victim.id);
    expect(genuine.status).toBe(200);
    expect(await genuine.json()).toHaveLength(1);
  });

  it('a refreshed session keeps working; after sign-out the refresh token is dead', async () => {
    const member = await createUser('returning', { onboarded: true });
    const first = (await member.client.auth.getSession()).data.session;
    expect(first?.refresh_token).toBeTruthy();
    const refreshed = must(await member.client.auth.refreshSession());
    expect(refreshed.session?.access_token).toBeTruthy();
    expect(refreshed.session?.access_token).not.toBe(first?.access_token);
    expect(rowsOf(must(await member.client.from('account_settings').select('user_id').eq('user_id', member.id)))).toHaveLength(1);

    const lastRefresh = refreshed.session?.refresh_token as string;
    await member.client.auth.signOut({ scope: 'global' });
    const reuse = await anonClient().auth.refreshSession({ refresh_token: lastRefresh });
    expect(reuse.error).toBeTruthy();
    expect(reuse.data.session).toBeNull();
  });
});
