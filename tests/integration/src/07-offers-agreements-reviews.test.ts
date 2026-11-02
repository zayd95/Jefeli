import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  adminProfile,
  createListing,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  must,
  notificationsOf,
  rpc,
  type TestUser,
} from './helpers';

describe('MKT-02 — price negotiation: offer → counter → accept', () => {
  let A: TestUser; // buyer
  let B: TestUser; // seller
  let C: TestUser; // outsider
  let productId: string;
  let offer1: string;
  let offer2: string;
  let agreementId: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    productId = await createListing(B, { title: 'Réfrigérateur LG', price: 150000, category: 'electromenager' });
  });

  it('the seller cannot make an offer on their own product', async () => {
    expectError(
      await B.client.rpc('make_offer', { p_product_id: productId, p_kind: 'price', p_amount_xof: 100000 }),
      'own_product',
    );
  });

  it('A offers a lower price; offer is visible to buyer and seller only', async () => {
    offer1 = await rpc<string>(A.client, 'make_offer', {
      p_product_id: productId,
      p_kind: 'price',
      p_amount_xof: 120000,
      p_message: 'Je peux passer ce soir',
    });
    const o = must(await B.client.from('offers').select('*').eq('id', offer1).single()) as any;
    expect(o).toMatchObject({ status: 'pending', amount_xof: 120000, proposer_id: A.id, recipient_id: B.id, kind: 'price' });
    expect(o.snapshot.product.title).toBe('Réfrigérateur LG');
    expect(must(await C.client.from('offers').select('*').eq('id', offer1))).toHaveLength(0);
    expect((await notificationsOf(B, 'offer_received')).map((n) => n.entity_id)).toContain(offer1);
    // A second pending offer on the same product is refused.
    expectError(
      await A.client.rpc('make_offer', { p_product_id: productId, p_kind: 'price', p_amount_xof: 125000 }),
      'offer_pending',
    );
    // Offers are never written directly.
    expectPermissionDenied(await A.client.from('offers').update({ amount_xof: 1 }).eq('id', offer1));
  });

  it('the buyer cannot accept their own offer; outsiders cannot respond', async () => {
    expectError(await A.client.rpc('respond_offer', { p_offer_id: offer1, p_accept: true }), 'not_allowed');
    expectError(await C.client.rpc('respond_offer', { p_offer_id: offer1, p_accept: true }), 'not_found');
    expectError(await C.client.rpc('counter_offer', { p_offer_id: offer1, p_amount_xof: 1 }), 'not_found');
  });

  it('withdraw is reserved to the proposer', async () => {
    expectError(await B.client.rpc('withdraw_offer', { p_offer_id: offer1 }), 'not_found');
    expectError(await C.client.rpc('withdraw_offer', { p_offer_id: offer1 }), 'not_found');
  });

  it('the seller counters; the original offer becomes "countered"', async () => {
    offer2 = await rpc<string>(B.client, 'counter_offer', { p_offer_id: offer1, p_amount_xof: 135000, p_message: 'Dernier prix' });
    const rows = must(await A.client.from('offers').select('id, status, amount_xof, proposer_id').in('id', [offer1, offer2])) as any[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[offer1].status).toBe('countered');
    expect(byId[offer2]).toMatchObject({ status: 'pending', amount_xof: 135000, proposer_id: B.id });
    // The countered offer can no longer be answered by its recipient.
    expectError(await B.client.rpc('respond_offer', { p_offer_id: offer1, p_accept: true }), 'invalid_transition');
    expectError(await B.client.rpc('counter_offer', { p_offer_id: offer1, p_amount_xof: 140000 }), 'invalid_transition');
    // Now the seller is the proposer and cannot accept their own counter-offer.
    expectError(await B.client.rpc('respond_offer', { p_offer_id: offer2, p_accept: true }), 'not_allowed');
  });

  it('the buyer accepts → agreement with an immutable snapshot of the terms', async () => {
    agreementId = await rpc<string>(A.client, 'respond_offer', { p_offer_id: offer2, p_accept: true });
    const a = must(await B.client.from('agreements').select('*').eq('id', agreementId).single()) as any;
    expect(a).toMatchObject({ status: 'agreed', amount_xof: 135000, buyer_id: A.id, seller_id: B.id, kind: 'price' });
    expect(a.terms).toMatchObject({ kind: 'price', amount_xof: 135000, accepted_by: A.id, cash_payer: null });
    expect(a.terms.product).toMatchObject({ id: productId, title: 'Réfrigérateur LG', price_xof: 150000 });
    expect(a.terms.buyer.id).toBe(A.id);
    expect(a.terms.seller.id).toBe(B.id);
    expect(a.terms.disclaimer).toMatch(/ne détient aucun fonds/);
    expect((await notificationsOf(B, 'offer_accepted')).map((n) => n.entity_id)).toContain(agreementId);

    // Editing the listing afterwards does not change the accepted terms.
    must(await B.client.from('products').update({ title: 'Réfrigérateur LG (vendu)', price_xof: 999999 }).eq('id', productId));
    const again = must(await A.client.from('agreements').select('terms').eq('id', agreementId).single()) as any;
    expect(again.terms.product.title).toBe('Réfrigérateur LG');
  });

  it('double acceptance fails with invalid_transition', async () => {
    expectError(await A.client.rpc('respond_offer', { p_offer_id: offer2, p_accept: true }), 'invalid_transition');
    expect(must(await adminClient.from('agreements').select('id').eq('offer_id', offer2))).toHaveLength(1);
  });

  it('agreements are invisible to outsiders and cannot be updated directly by members', async () => {
    expect(must(await C.client.from('agreements').select('*').eq('id', agreementId))).toHaveLength(0);
    expectPermissionDenied(await A.client.from('agreements').update({ amount_xof: 1 }).eq('id', agreementId));
    expectPermissionDenied(await B.client.from('agreements').update({ status: 'completed' }).eq('id', agreementId));
    expectPermissionDenied(await A.client.from('agreements').delete().eq('id', agreementId));
    // Even the service role cannot rewrite accepted terms (trigger).
    expectError(
      await adminClient.from('agreements').update({ terms: { forged: true } }).eq('id', agreementId),
      'agreement_terms_immutable',
    );
  });

  it('a new offer can be withdrawn by its proposer only once', async () => {
    const product2 = await createListing(B, { title: 'Ventilateur', price: 15000 });
    const o = await rpc<string>(A.client, 'make_offer', { p_product_id: product2, p_kind: 'price', p_amount_xof: 12000 });
    await rpc(A.client, 'withdraw_offer', { p_offer_id: o });
    const row = must(await B.client.from('offers').select('status').eq('id', o).single()) as any;
    expect(row.status).toBe('withdrawn');
    expectError(await A.client.rpc('withdraw_offer', { p_offer_id: o }), 'invalid_transition');
    expectError(await B.client.rpc('respond_offer', { p_offer_id: o, p_accept: true }), 'invalid_transition');
  });

  it('clients cannot create offers or agreements by direct insert', async () => {
    expectPermissionDenied(
      await A.client.from('offers').insert({ kind: 'price', product_id: productId, buyer_id: A.id, seller_id: B.id }),
    );
    expectPermissionDenied(await A.client.from('agreements').insert({ offer_id: offer1 }));
  });
});

describe('MKT-03 — barter with an XOF difference', () => {
  let A: TestUser; // offers their item
  let B: TestUser; // owns the target item
  let C: TestUser; // outsider
  let itemA: string;
  let itemB: string;
  let itemBSaleOnly: string;
  let itemC: string;
  let offer1: string;
  let offer2: string;
  let agreementId: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    itemA = await createListing(A, { title: 'Vélo VTT', price: 90000, mode: 'sale_or_trade', category: 'sport' });
    itemB = await createListing(B, { title: 'Samsung Galaxy S21', price: 120000, mode: 'sale_or_trade', category: 'telephones' });
    itemBSaleOnly = await createListing(B, { title: 'Télévision 43 pouces', price: 110000, mode: 'sale' });
    itemC = await createListing(C, { title: 'Guitare', price: 50000, mode: 'trade' });
  });

  it("offering someone else's product is refused", async () => {
    expectError(
      await A.client.rpc('make_offer', {
        p_product_id: itemB, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: itemC,
      }),
      'invalid_offered_product',
    );
    expectError(
      await A.client.rpc('make_offer', {
        p_product_id: itemB, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: itemB,
      }),
      'invalid_offered_product',
    );
  });

  it('a barter on a sale-only listing is refused (not_for_trade)', async () => {
    expectError(
      await A.client.rpc('make_offer', {
        p_product_id: itemBSaleOnly, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: itemA,
      }),
      'not_for_trade',
    );
  });

  it('A offers their bike + 15 000 XOF paid by the buyer', async () => {
    offer1 = await rpc<string>(A.client, 'make_offer', {
      p_product_id: itemB,
      p_kind: 'barter',
      p_amount_xof: 15000,
      p_offered_product_id: itemA,
      p_cash_payer: 'buyer',
      p_message: 'Mon vélo + 15 000 F',
    });
    const o = must(await B.client.from('offers').select('*').eq('id', offer1).single()) as any;
    expect(o).toMatchObject({ kind: 'barter', amount_xof: 15000, cash_payer: 'buyer', offered_product_id: itemA });
    expect(o.snapshot.offered_product.title).toBe('Vélo VTT');
  });

  it('B counters the amount; C cannot accept', async () => {
    offer2 = await rpc<string>(B.client, 'counter_offer', {
      p_offer_id: offer1,
      p_amount_xof: 25000,
      p_cash_payer: 'buyer',
      p_message: 'Plutôt 25 000',
    });
    expectError(await C.client.rpc('respond_offer', { p_offer_id: offer2, p_accept: true }), 'not_found');
    expect(must(await C.client.from('offers').select('id').in('id', [offer1, offer2]))).toHaveLength(0);
  });

  it('A accepts: agreement terms hold both product snapshots and the cash payer', async () => {
    agreementId = await rpc<string>(A.client, 'respond_offer', { p_offer_id: offer2, p_accept: true });
    const a = must(await A.client.from('agreements').select('*').eq('id', agreementId).single()) as any;
    expect(a).toMatchObject({
      kind: 'barter', amount_xof: 25000, cash_payer: 'buyer', buyer_id: A.id, seller_id: B.id,
      product_id: itemB, offered_product_id: itemA,
    });
    expect(a.terms.product).toMatchObject({ id: itemB, title: 'Samsung Galaxy S21', seller_id: B.id });
    expect(a.terms.offered_product).toMatchObject({ id: itemA, title: 'Vélo VTT', seller_id: A.id });
    expect(a.terms).toMatchObject({ amount_xof: 25000, cash_payer: 'buyer', kind: 'barter' });
    expect(a.terms.product.image_path).toMatch(new RegExp(`^${B.id}/`));
    expect(a.terms.offered_product.image_path).toMatch(new RegExp(`^${A.id}/`));
  });

  it('agreements cannot be UPDATEd directly by clients; outsiders cannot see them', async () => {
    expectPermissionDenied(await A.client.from('agreements').update({ cash_payer: 'seller' }).eq('id', agreementId));
    expectPermissionDenied(await B.client.from('agreements').update({ amount_xof: 0 }).eq('id', agreementId));
    expect(must(await C.client.from('agreements').select('*').eq('id', agreementId))).toHaveLength(0);
  });
});

describe('Reviews after a completed agreement', () => {
  let A: TestUser;
  let B: TestUser;
  let C: TestUser;
  let agreementId: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    const p = await createListing(B, { title: 'Sac en cuir', price: 20000 });
    const o = await rpc<string>(A.client, 'make_offer', { p_product_id: p, p_kind: 'price', p_amount_xof: 18000 });
    agreementId = await rpc<string>(B.client, 'respond_offer', { p_offer_id: o, p_accept: true });
  });

  it('leave_review fails until BOTH parties confirmed completion', async () => {
    expectError(await A.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 5, p_body: 'Top' }), 'review_not_allowed');
    expect(await rpc(A.client, 'confirm_agreement_completed', { p_agreement_id: agreementId })).toBe('waiting_other_party');
    expectError(await A.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 5, p_body: 'Top' }), 'review_not_allowed');
    expectError(await C.client.rpc('confirm_agreement_completed', { p_agreement_id: agreementId }), 'not_found');
    expect(await rpc(B.client, 'confirm_agreement_completed', { p_agreement_id: agreementId })).toBe('completed');
    const a = must(await A.client.from('agreements').select('status').eq('id', agreementId).single()) as any;
    expect(a.status).toBe('completed');
  });

  it('each party reviews once; aggregates update; outsiders cannot review', async () => {
    const before = await adminProfile(B.id);
    const rid = await rpc<string>(A.client, 'leave_review', { p_agreement_id: agreementId, p_rating: 5, p_body: 'Vendeuse sérieuse' });
    expect(rid).toBeTruthy();
    expectError(await A.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 1, p_body: 'Encore' }), 'already_reviewed');
    expectError(await C.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 1, p_body: 'Faux avis' }), 'not_found');
    expectError(await B.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 9, p_body: '' }), 'invalid_rating');
    await rpc(B.client, 'leave_review', { p_agreement_id: agreementId, p_rating: 4, p_body: 'Acheteur ponctuel' });

    const b = await adminProfile(B.id);
    expect(b.rating_count).toBe(before.rating_count + 1);
    expect(b.rating_sum).toBe(before.rating_sum + 5);
    const a = await adminProfile(A.id);
    expect([a.rating_sum, a.rating_count]).toEqual([4, 1]);
    expect((await notificationsOf(B, 'review_received')).map((n) => n.entity_id)).toContain(rid);
    // Reviews are public on the profile, but never writable directly.
    expect(must(await C.client.from('reviews').select('rating').eq('reviewee_id', B.id))).toEqual([{ rating: 5 }]);
    expectPermissionDenied(await A.client.from('reviews').update({ rating: 1 }).eq('id', rid));
    expectPermissionDenied(
      await C.client.from('reviews').insert({ agreement_id: agreementId, reviewer_id: C.id, reviewee_id: B.id, rating: 1 }),
    );
  });

  it('a completed agreement can no longer be closed', async () => {
    expectError(
      await A.client.rpc('close_agreement', { p_agreement_id: agreementId, p_outcome: 'disputed', p_reason: 'x' }),
      'invalid_transition',
    );
  });
});

describe('Blocking does not trap open offers and agreements', () => {
  let buyer: TestUser;
  let seller: TestUser;

  beforeAll(async () => {
    [buyer, seller] = await Promise.all([createUser('buyer'), createUser('seller')]);
  });

  it('after the seller blocks the buyer, the buyer can still withdraw a pending offer', async () => {
    const p = await createListing(seller, { title: 'Montre', price: 40000 });
    const o = await rpc<string>(buyer.client, 'make_offer', { p_product_id: p, p_kind: 'price', p_amount_xof: 30000 });
    must(await seller.client.from('blocks').insert({ blocker_id: seller.id, blocked_id: buyer.id }));
    const res = await buyer.client.rpc('withdraw_offer', { p_offer_id: o });
    expect(res.error?.message ?? null).toBeNull();
    const row = must(await adminClient.from('offers').select('status').eq('id', o).single()) as any;
    expect(row.status).toBe('withdrawn');
    // ...and the blocker is not notified across the block.
    expect(await notificationsOf(seller, 'offer_withdrawn')).toHaveLength(0);
  });

  it('a member who blocked the other party can still dispute the agreement (opens a moderation report)', async () => {
    const [b2, s2] = await Promise.all([createUser('buyer2'), createUser('seller2')]);
    const p = await createListing(s2, { title: 'Ordinateur portable', price: 200000 });
    const o = await rpc<string>(b2.client, 'make_offer', { p_product_id: p, p_kind: 'price', p_amount_xof: 180000 });
    const agreementId = await rpc<string>(s2.client, 'respond_offer', { p_offer_id: o, p_accept: true });
    // The buyer never pays and turns abusive; the seller blocks, then disputes.
    must(await s2.client.from('blocks').insert({ blocker_id: s2.id, blocked_id: b2.id }));
    const res = await s2.client.rpc('close_agreement', {
      p_agreement_id: agreementId,
      p_outcome: 'disputed',
      p_reason: 'Acheteur injoignable après accord',
    });
    expect(res.error?.message ?? null).toBeNull();
    const a = must(await adminClient.from('agreements').select('status').eq('id', agreementId).single()) as any;
    expect(a.status).toBe('disputed');
    const reports = must(
      await adminClient.from('reports').select('reason, target_owner_id').eq('target_type', 'agreement').eq('target_id', agreementId),
    ) as any[];
    expect(reports).toEqual([{ reason: 'dispute', target_owner_id: b2.id }]);
    expectNoRowsAffected(await b2.client.from('reports').select('*').eq('target_id', agreementId));
  });
});
