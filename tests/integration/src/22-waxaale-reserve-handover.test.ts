/**
 * Pilot cut (c) — supabase/migrations/20261115000100_waxaale_reserve_handover.sql
 *   - accepting an offer reserves the item (a barter reserves both items);
 *   - every other pending offer on those items is closed, each waiting buyer gets a system line in
 *     their chat and an `offer_closed` notification;
 *   - a reserved item takes no new offers; cancelling frees it, completing sells it;
 *   - the handover step (when / where) is for the two members only, while the agreement is open;
 *   - every offer / agreement notification carries its conversation_id (deep link to the chat).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, createListing, createUser, expectError, must, rpc, token, type TestUser } from './helpers';

async function productStatus(id: string): Promise<string> {
  return (must(await adminClient.from('products').select('status').eq('id', id).single()) as { status: string }).status;
}
async function offerRow(id: string) {
  return must(await adminClient.from('offers').select('status, conversation_id').eq('id', id).single()) as { status: string; conversation_id: string };
}
async function notificationsOf(user: TestUser, type: string) {
  return must(await user.client.from('notifications').select('type, entity_type, entity_id, data').eq('type', type)) as {
    type: string;
    entity_type: string;
    entity_id: string;
    data: Record<string, unknown>;
  }[];
}

describe('accepting an offer reserves the item and closes the competition', () => {
  let S: TestUser;
  let B1: TestUser;
  let B2: TestUser;
  let B3: TestUser;
  let product: string;
  let o1: string;
  let o2: string;
  let o3: string;
  let agreement: string;

  beforeAll(async () => {
    S = await createUser('ResSeller', { onboarded: true });
    B1 = await createUser('ResBuyerA', { onboarded: true });
    B2 = await createUser('ResBuyerB', { onboarded: true });
    B3 = await createUser('ResBuyerC', { onboarded: true });
    product = await createListing(S, { title: `Vélo ${token(6)}`, price: 90000 });
    o1 = await rpc<string>(B1.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 80000, p_message: '' });
    o2 = await rpc<string>(B2.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 75000, p_message: '' });
    // The seller countered B3: the pending offer is now the seller's, waiting on B3.
    const first = await rpc<string>(B3.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 60000, p_message: '' });
    o3 = await rpc<string>(S.client, 'counter_offer', { p_offer_id: first, p_amount_xof: 85000, p_message: '' });
    agreement = await rpc<string>(S.client, 'respond_offer', { p_offer_id: o1, p_accept: true });
  });

  it('the item is reserved and the other pending offers are closed', async () => {
    expect(await productStatus(product)).toBe('reserved');
    expect((await offerRow(o1)).status).toBe('accepted');
    expect((await offerRow(o2)).status).toBe('closed');
    expect((await offerRow(o3)).status).toBe('closed');
  });

  it('each waiting buyer gets a chat line and a notification that opens that chat', async () => {
    for (const [buyer, offer] of [
      [B2, o2],
      [B3, o3],
    ] as const) {
      const { conversation_id } = await offerRow(offer);
      const line = must(await buyer.client.from('messages').select('kind, body, offer_id').eq('conversation_id', conversation_id).eq('body', 'offer_closed')) as unknown[];
      expect(line).toHaveLength(1);
      const n = await notificationsOf(buyer, 'offer_closed');
      expect(n).toHaveLength(1);
      expect(n[0]).toMatchObject({ entity_type: 'offer', entity_id: offer });
      expect(n[0]!.data.conversation_id).toBe(conversation_id);
      expect(String(n[0]!.data.product_title)).toMatch(/^Vélo /);
    }
    // The winning buyer is not told their offer was closed.
    expect(await notificationsOf(B1, 'offer_closed')).toHaveLength(0);
  });

  it('every offer / agreement notification carries its conversation', async () => {
    const accepted = await notificationsOf(B1, 'offer_accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ entity_type: 'agreement', entity_id: agreement });
    expect(accepted[0]!.data.conversation_id).toBe((await offerRow(o1)).conversation_id);
    const received = await notificationsOf(S, 'offer_received');
    expect(received.length).toBeGreaterThanOrEqual(3);
    for (const n of received) expect(typeof n.data.conversation_id).toBe('string');
  });

  it('a reserved item takes no new offer, and a closed offer cannot be answered', async () => {
    const B4 = await createUser('ResBuyerD', { onboarded: true });
    expectError(await B4.client.rpc('make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 70000, p_message: '' }), 'product_unavailable');
    expectError(await S.client.rpc('respond_offer', { p_offer_id: o2, p_accept: true }), 'invalid_transition');
    expectError(await B3.client.rpc('respond_offer', { p_offer_id: o3, p_accept: true }), 'invalid_transition');
  });

  it('handover: only the two members, valid time and place, while the agreement is open', async () => {
    const at = new Date(Date.now() + 26 * 3_600_000).toISOString();
    must(await B1.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: at, p_place: 'Station Total, VDN' }));
    const row = must(await S.client.from('agreements').select('handover_at, handover_place, handover_by').eq('id', agreement).single()) as any;
    expect(row.handover_place).toBe('Station Total, VDN');
    expect(row.handover_by).toBe(B1.id);
    expect(new Date(row.handover_at).toISOString()).toBe(at);
    const n = await notificationsOf(S, 'agreement_handover');
    expect(n).toHaveLength(1);
    expect(n[0]!.data).toMatchObject({ place: 'Station Total, VDN', conversation_id: (await offerRow(o1)).conversation_id });

    expectError(await B2.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: at, p_place: 'Ailleurs' }), 'not_found');
    expectError(await S.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: at, p_place: 'x' }), 'invalid_handover');
    expectError(
      await S.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), p_place: 'Marché Sandaga' }),
      'invalid_handover',
    );
    expectError(
      await S.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: new Date(Date.now() + 40 * 86_400_000).toISOString(), p_place: 'Marché Sandaga' }),
      'invalid_handover',
    );
    // Columns are not writable directly.
    const direct = await S.client.from('agreements').update({ handover_place: 'Hack' }).eq('id', agreement).select();
    expect(direct.error ?? (direct.data as unknown[]).length === 0).toBeTruthy();
  });

  it('both members declare the exchange done: the item is sold; handover is then refused', async () => {
    expect(await rpc<string>(B1.client, 'confirm_agreement_completed', { p_agreement_id: agreement })).toBe('waiting_other_party');
    expect(await productStatus(product)).toBe('reserved');
    expect(await rpc<string>(S.client, 'confirm_agreement_completed', { p_agreement_id: agreement })).toBe('completed');
    expect(await productStatus(product)).toBe('sold');
    expectError(await S.client.rpc('set_agreement_handover', { p_agreement_id: agreement, p_at: new Date(Date.now() + 3_600_000).toISOString(), p_place: 'Marché Sandaga' }), 'invalid_transition');
  });
});

describe('cancelling frees the item; a barter reserves both items', () => {
  it('cancel → back on sale, and offers are accepted again', async () => {
    const S = await createUser('CanSeller', { onboarded: true });
    const B = await createUser('CanBuyer', { onboarded: true });
    const product = await createListing(S, { title: `Table ${token(6)}`, price: 40000 });
    const o = await rpc<string>(B.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 35000, p_message: '' });
    const a = await rpc<string>(S.client, 'respond_offer', { p_offer_id: o, p_accept: true });
    expect(await productStatus(product)).toBe('reserved');
    must(await B.client.rpc('close_agreement', { p_agreement_id: a, p_outcome: 'canceled', p_reason: 'Plus disponible' }));
    expect(await productStatus(product)).toBe('active');
    const B2 = await createUser('CanBuyer2', { onboarded: true });
    await rpc<string>(B2.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 38000, p_message: '' });
  });

  it('a dispute keeps the item reserved for moderation', async () => {
    const S = await createUser('DisSeller', { onboarded: true });
    const B = await createUser('DisBuyer', { onboarded: true });
    const product = await createListing(S, { title: `Lampe ${token(6)}`, price: 15000 });
    const o = await rpc<string>(B.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 12000, p_message: '' });
    const a = await rpc<string>(S.client, 'respond_offer', { p_offer_id: o, p_accept: true });
    must(await B.client.rpc('close_agreement', { p_agreement_id: a, p_outcome: 'disputed', p_reason: 'Article différent' }));
    expect(await productStatus(product)).toBe('reserved');
  });

  it('barter: both items reserved; pending offers on the offered item are closed too', async () => {
    const S = await createUser('BarSeller', { onboarded: true });
    const B = await createUser('BarBuyer', { onboarded: true });
    const C = await createUser('BarOther', { onboarded: true });
    const wanted = await createListing(S, { title: `Console ${token(6)}`, price: 120000, mode: 'sale_or_trade' });
    const mine = await createListing(B, { title: `Tablette ${token(6)}`, price: 100000, mode: 'sale_or_trade' });
    // C wants B's tablet: this offer must be closed once B trades it away.
    const cOffer = await rpc<string>(C.client, 'make_offer', { p_product_id: mine, p_kind: 'price', p_amount_xof: 90000, p_message: '' });
    const barter = await rpc<string>(B.client, 'make_offer', {
      p_product_id: wanted,
      p_kind: 'barter',
      p_amount_xof: 20000,
      p_offered_product_id: mine,
      p_cash_payer: 'buyer',
      p_message: '',
    });
    const a = await rpc<string>(S.client, 'respond_offer', { p_offer_id: barter, p_accept: true });
    expect(await productStatus(wanted)).toBe('reserved');
    expect(await productStatus(mine)).toBe('reserved');
    expect((await offerRow(cOffer)).status).toBe('closed');
    // C (proposer) is told; B, who owns the tablet, is the recipient and is not.
    expect(await notificationsOf(C, 'offer_closed')).toHaveLength(1);
    must(await S.client.rpc('confirm_agreement_completed', { p_agreement_id: a }));
    must(await B.client.rpc('confirm_agreement_completed', { p_agreement_id: a }));
    expect(await productStatus(wanted)).toBe('sold');
    expect(await productStatus(mine)).toBe('sold');
  });
});
