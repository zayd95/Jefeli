/**
 * Pilot cut (g) — « Jëf lite » (20261115000400_jef_lite_levels.sql)
 *   - member_level: read-only public level from completed exchanges (sales + swaps), partners,
 *     reviews; no balance anywhere;
 *   - a new seller's first listing gets 24 h of « Nouveau » exposure, once per member, first in its
 *     aisle (default order only); clients cannot set or extend it.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, anonClient, createListing, createUser, expectError, must, rpc, token, type TestUser } from './helpers';

/** One real exchange: S lists, B offers, S accepts, both declare it done. */
async function completeDeal(S: TestUser, B: TestUser): Promise<string> {
  const product = await createListing(S, { title: `Deal ${token(6)}`, price: 10000 });
  const offer = await rpc<string>(B.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 9000, p_message: '' });
  const agreement = await rpc<string>(S.client, 'respond_offer', { p_offer_id: offer, p_accept: true });
  await rpc(S.client, 'confirm_agreement_completed', { p_agreement_id: agreement });
  await rpc(B.client, 'confirm_agreement_completed', { p_agreement_id: agreement });
  return agreement;
}

async function swap(S: TestUser, B: TestUser): Promise<string> {
  const wanted = await createListing(S, { title: `Troc ${token(6)}`, price: 10000, mode: 'trade' });
  const mine = await createListing(B, { title: `Contre ${token(6)}`, price: 9000, mode: 'trade' });
  const offer = await rpc<string>(B.client, 'make_offer', { p_product_id: wanted, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: mine, p_message: '' });
  const agreement = await rpc<string>(S.client, 'respond_offer', { p_offer_id: offer, p_accept: true });
  await rpc(S.client, 'confirm_agreement_completed', { p_agreement_id: agreement });
  await rpc(B.client, 'confirm_agreement_completed', { p_agreement_id: agreement });
  return agreement;
}

describe('member_level (Jëf lite)', () => {
  let S: TestUser;
  let B1: TestUser;
  let B2: TestUser;
  const agreements: string[] = [];

  beforeAll(async () => {
    S = await createUser('LvlSeller', { onboarded: true });
    B1 = await createUser('LvlBuyerA', { onboarded: true });
    B2 = await createUser('LvlBuyerB', { onboarded: true });
  });

  it('a new member is « nouveau », with zero counts and no balance field', async () => {
    const lvl = await rpc(anonClient(), 'member_level', { p_user: S.id });
    expect(lvl).toEqual({ level: 1, key: 'nouveau', deals: 0, swaps: 0, partners: 0 });
  });

  it('two exchanges are not enough; three with two partners make « fiable » (sales and swaps count)', async () => {
    agreements.push(await completeDeal(S, B1));
    agreements.push(await swap(S, B1));
    expect(await rpc(S.client, 'member_level', { p_user: S.id })).toMatchObject({ level: 1, deals: 1, swaps: 1, partners: 1 });
    agreements.push(await completeDeal(S, B2));
    expect(await rpc(anonClient(), 'member_level', { p_user: S.id })).toEqual({ level: 2, key: 'fiable', deals: 2, swaps: 1, partners: 2 });
    // The buyer side counts too: B1 has two exchanges with one partner — still « nouveau ».
    expect(await rpc(anonClient(), 'member_level', { p_user: B1.id })).toMatchObject({ level: 1, deals: 1, swaps: 1, partners: 1 });
  });

  it('an open (not completed) or cancelled agreement does not count', async () => {
    const product = await createListing(S, { title: `Ouvert ${token(6)}`, price: 10000 });
    const offer = await rpc<string>(B2.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 9000, p_message: '' });
    const a = await rpc<string>(S.client, 'respond_offer', { p_offer_id: offer, p_accept: true });
    await rpc(S.client, 'confirm_agreement_completed', { p_agreement_id: a }); // one side only
    expect(await rpc(anonClient(), 'member_level', { p_user: S.id })).toMatchObject({ deals: 2, swaps: 1 });
  });

  it('three poor reviews (average < 4) drop « fiable »', async () => {
    for (const a of agreements) {
      const reviewer = (must(await adminClient.from('agreements').select('buyer_id').eq('id', a).single()) as { buyer_id: string }).buyer_id === B1.id ? B1 : B2;
      must(await reviewer.client.rpc('leave_review', { p_agreement_id: a, p_rating: 2, p_body: '' }));
    }
    expect(await rpc(anonClient(), 'member_level', { p_user: S.id })).toMatchObject({ level: 1, key: 'nouveau' });
  });

  it('blocked viewers and unknown members get nothing', async () => {
    const X = await createUser('LvlBlocker', { onboarded: true });
    must(await X.client.from('blocks').insert({ blocker_id: X.id, blocked_id: S.id }));
    expect(await rpc(X.client, 'member_level', { p_user: S.id })).toBeNull();
    expect(await rpc(anonClient(), 'member_level', { p_user: '00000000-0000-4000-8000-000000000000' })).toBeNull();
  });
});

describe('« Nouveau » exposure of a first listing', () => {
  it('only the very first listing of a member, for 24 h, never regained, not forgeable', async () => {
    const N = await createUser('NewSeller', { onboarded: true });
    const first = await createListing(N, { title: `Premier ${token(6)}`, category: 'electronique' });
    const row = must(await adminClient.from('products').select('new_seller_until, created_at').eq('id', first).single()) as { new_seller_until: string; created_at: string };
    const hours = (new Date(row.new_seller_until).getTime() - new Date(row.created_at).getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);

    const second = await createListing(N, { title: `Second ${token(6)}`, category: 'electronique' });
    expect((must(await adminClient.from('products').select('new_seller_until').eq('id', second).single()) as any).new_seller_until).toBeNull();

    // Archive the first and list again: no new exposure.
    must(await N.client.from('products').update({ status: 'archived' }).eq('id', first));
    const third = await createListing(N, { title: `Troisième ${token(6)}`, category: 'electronique' });
    expect((must(await adminClient.from('products').select('new_seller_until').eq('id', third).single()) as any).new_seller_until).toBeNull();

    // Not writable by the seller.
    const forged = await N.client.from('products').update({ new_seller_until: new Date(Date.now() + 86_400_000 * 30).toISOString() } as never).eq('id', third);
    expect(forged.error).toBeTruthy();
  });

  it('comes first in its aisle in the default order, after a newer listing by an established seller', async () => {
    const slug = 'electromenager';
    const O = await createUser('OldSeller', { onboarded: true });
    await createListing(O, { title: `Ancien ${token(6)}`, category: slug }); // O's own first (exposed)
    const N = await createUser('NewcomerSeller', { onboarded: true });
    const fresh = await createListing(N, { title: `Nouveau venu ${token(6)}`, category: slug });
    const later = await createListing(O, { title: `Plus récent ${token(6)}`, category: slug }); // newer, not exposed
    const ids = ((await rpc<{ id: string; new_seller_until: string | null }[]>(anonClient(), 'explore_market', { p_categories: [slug], p_limit: 50 })) ?? []).map((p) => p.id);
    expect(ids.indexOf(fresh)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(fresh)).toBeLessThan(ids.indexOf(later));
    // A price sort is the member's choice: exposure does not override it.
    const byPrice = (await rpc<{ id: string; price_xof: number }[]>(anonClient(), 'explore_market', { p_categories: [slug], p_sort: 'price_desc', p_limit: 50 })) ?? [];
    const prices = byPrice.map((p) => p.price_xof ?? 0);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });
});
