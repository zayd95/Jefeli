/**
 * Pilot cut (f) — Wecci « Donner » (20261115000200/300): price 0 is allowed only in « give » mode
 * (and forced there); no other mode may store 0 F; a gift takes no offer of any kind; the giver
 * cannot turn it into a 0 F sale afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, createListing, createUser, expectError, must, rpc, token, type TestUser } from './helpers';

describe('give mode', () => {
  let G: TestUser;
  let B: TestUser;
  let gift: string;

  beforeAll(async () => {
    G = await createUser('Giver', { onboarded: true });
    B = await createUser('Taker', { onboarded: true });
    gift = await createListing(G, { title: `Poussette ${token(6)}`, price: 0, mode: 'give' });
  });

  it('stores a gift at 0 F, fixed — whatever price the client sent', async () => {
    const row = must(await adminClient.from('products').select('listing_mode, price_xof, price_mode').eq('id', gift).single());
    expect(row).toEqual({ listing_mode: 'give', price_xof: 0, price_mode: 'fixed' });
    const other = await createListing(G, { title: `Livres ${token(6)}`, price: 15000, mode: 'give', priceMode: 'negotiable' });
    expect(must(await adminClient.from('products').select('price_xof, price_mode').eq('id', other).single())).toEqual({ price_xof: 0, price_mode: 'fixed' });
  });

  it('0 F stays refused in every other mode', async () => {
    for (const mode of ['sale', 'sale_or_trade'] as const) {
      const r = await G.client.rpc('create_listing', {
        p_title: `Zéro ${token(5)}`, p_description: '', p_price_xof: 0, p_category_slug: 'autres', p_condition: 'good',
        p_listing_mode: mode, p_quantity: 1, p_city: 'Dakar', p_neighborhood: null, p_delivery_options: ['pickup'],
        p_delivery_notes: '', p_media: [],
      });
      expectError(r, 'invalid_amount');
    }
    const sale = await createListing(G, { title: `Vente ${token(6)}`, price: 5000 });
    expectError(await G.client.from('products').update({ price_xof: 0 }).eq('id', sale), /check constraint|products_price_xof_check/);
    // A gift cannot become a 0 F sale, nor a gift with a price.
    expectError(await G.client.from('products').update({ listing_mode: 'sale' }).eq('id', gift), /check constraint|products_price_xof_check/);
    expectError(await G.client.from('products').update({ price_xof: 2000 }).eq('id', gift), /check constraint|products_price_xof_check/);
  });

  it('a gift takes no price offer and no barter; one cannot offer a gift in a barter', async () => {
    expectError(await B.client.rpc('make_offer', { p_product_id: gift, p_kind: 'price', p_amount_xof: 1000, p_message: '' }), 'given_away');
    const mine = await createListing(B, { title: `Radio ${token(6)}`, price: 8000, mode: 'sale_or_trade' });
    expectError(
      await B.client.rpc('make_offer', { p_product_id: gift, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: mine, p_message: '' }),
      'given_away',
    );
    const swap = await createListing(G, { title: `Table ${token(6)}`, price: 20000, mode: 'trade' });
    const myGift = await createListing(B, { title: `Don ${token(6)}`, price: 0, mode: 'give' });
    expectError(
      await B.client.rpc('make_offer', { p_product_id: swap, p_kind: 'barter', p_amount_xof: 0, p_offered_product_id: myGift, p_message: '' }),
      'invalid_offered_product',
    );
  });

  it('the taker writes to the giver about the gift (product-linked chat)', async () => {
    const cid = await rpc<string>(B.client, 'message_about_product', { p_product_id: gift, p_body: 'Je suis intéressée, merci !' });
    const msgs = must(await G.client.from('messages').select('kind, product_id').eq('conversation_id', cid)) as { kind: string; product_id: string | null }[];
    expect(msgs.some((m) => m.product_id === gift)).toBe(true);
  });
});
