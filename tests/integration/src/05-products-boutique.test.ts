import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  adminProfile,
  anonClient,
  canSee,
  createListing,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  listingArgs,
  must,
  rpc,
  token,
  uploadImage,
  type TestUser,
} from './helpers';

describe('PROF-01 / MKT-01 — first listing creates the boutique; listing lifecycle', () => {
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;
  let productId: string;

  beforeAll(async () => {
    [seller, buyer, other] = await Promise.all([createUser('seller'), createUser('buyer'), createUser('other')]);
  });

  it('the first create_listing auto-creates the boutique and bumps products_count', async () => {
    expect(must(await adminClient.from('boutiques').select('*').eq('owner_id', seller.id))).toHaveLength(0);
    expect((await adminProfile(seller.id)).products_count).toBe(0);

    productId = await createListing(seller, {
      title: 'iPhone 12 occasion',
      description: 'Très bon état, batterie 88 %',
      price: 185000,
      category: 'telephones',
      condition: 'very_good',
      city: 'Dakar',
      neighborhood: 'Médina',
    });

    const boutiques = must(await adminClient.from('boutiques').select('*').eq('owner_id', seller.id)) as any[];
    expect(boutiques).toHaveLength(1);
    expect((await adminProfile(seller.id)).products_count).toBe(1);
    // A second listing does not create a second boutique.
    await createListing(seller, { title: 'Coque iPhone 12', price: 3000 });
    expect(must(await adminClient.from('boutiques').select('owner_id').eq('owner_id', seller.id))).toHaveLength(1);
    expect((await adminProfile(seller.id)).products_count).toBe(2);
  });

  it('buyer and logged-out visitor see photo, condition, XOF price and location', async () => {
    for (const client of [buyer.client, anonClient()]) {
      const p = must(
        await client.from('products').select('*, product_media(*)').eq('id', productId).single(),
      ) as any;
      expect(p).toMatchObject({
        title: 'iPhone 12 occasion',
        price_xof: 185000,
        condition: 'very_good',
        city: 'Dakar',
        neighborhood: 'Médina',
        status: 'active',
        seller_id: seller.id,
      });
      expect(p.product_media).toHaveLength(1);
      expect(p.product_media[0].storage_path.startsWith(`${seller.id}/`)).toBe(true);
      expect(await canSee(client, 'boutiques', seller.id, 'owner_id')).toBe(true);
    }
  });

  it('a non-owner cannot update or delete the product', async () => {
    expectNoRowsAffected(await buyer.client.from('products').update({ price_xof: 1 }).eq('id', productId).select());
    expectNoRowsAffected(await buyer.client.from('products').update({ status: 'sold' }).eq('id', productId).select());
    expectNoRowsAffected(await buyer.client.from('products').delete().eq('id', productId).select());
    expectNoRowsAffected(await buyer.client.from('product_media').delete().eq('product_id', productId).select());
    expectNoRowsAffected(
      await buyer.client.from('boutiques').update({ description: 'Piraté' }).eq('owner_id', seller.id).select(),
    );
    const truth = must(await adminClient.from('products').select('price_xof, status').eq('id', productId).single());
    expect(truth).toEqual({ price_xof: 185000, status: 'active' });
    expect(must(await adminClient.from('product_media').select('id').eq('product_id', productId))).toHaveLength(1);
  });

  it('protected columns and direct inserts are refused even for the owner', async () => {
    expectPermissionDenied(await seller.client.from('products').update({ moderation_status: 'active' }).eq('id', productId));
    expectPermissionDenied(await seller.client.from('products').update({ save_count: 999 }).eq('id', productId));
    expectPermissionDenied(await seller.client.from('products').update({ seller_id: buyer.id }).eq('id', productId));
    expectPermissionDenied(
      await seller.client
        .from('products')
        .insert({ seller_id: seller.id, title: 'Direct', price_xof: 1, category_slug: 'autres' }),
    );
    expectPermissionDenied(await seller.client.from('boutiques').insert({ owner_id: buyer.id }));
  });

  it('the seller marks the item reserved then sold; the buyer sees each state', async () => {
    must(await seller.client.from('products').update({ status: 'reserved' }).eq('id', productId));
    let seen = must(await buyer.client.from('products').select('status').eq('id', productId).single()) as any;
    expect(seen.status).toBe('reserved');
    expect((await adminProfile(seller.id)).products_count).toBe(2);
    // A reserved item cannot receive offers.
    expectError(
      await buyer.client.rpc('make_offer', { p_product_id: productId, p_kind: 'price', p_amount_xof: 150000 }),
      'product_unavailable',
    );

    must(await seller.client.from('products').update({ status: 'sold' }).eq('id', productId));
    seen = must(await buyer.client.from('products').select('status, sold_at').eq('id', productId).single()) as any;
    expect(seen.status).toBe('sold');
    expect(seen.sold_at).toBeTruthy();
    expect((await adminProfile(seller.id)).products_count).toBe(1);
  });

  it('archived listings are hidden from everyone but the seller', async () => {
    const archived = await createListing(seller, { title: 'Ancien article' });
    expect(await canSee(anonClient(), 'products', archived)).toBe(true);
    must(await seller.client.from('products').update({ status: 'archived' }).eq('id', archived));
    expect(await canSee(anonClient(), 'products', archived)).toBe(false);
    expect(await canSee(buyer.client, 'products', archived)).toBe(false);
    expect(await canSee(buyer.client, 'product_media', archived, 'product_id')).toBe(false);
    expect(await canSee(seller.client, 'products', archived)).toBe(true);
  });

  it('prohibited items are rejected (accent/case-insensitive), on create and on edit', async () => {
    const path = await uploadImage(seller, 'public-media');
    expectError(
      await seller.client.rpc('create_listing', listingArgs(path, { title: 'Tramadol 50mg boîte' })),
      'prohibited_item',
    );
    expectError(
      await seller.client.rpc('create_listing', listingArgs(path, { title: 'Lot de produits', description: 'COCAÏNE pure' })),
      'prohibited_item',
    );
    const ok = await createListing(seller, { title: 'Pagne tissé main', mediaPath: path });
    expectError(await seller.client.from('products').update({ title: 'Pistolet à billes' }).eq('id', ok), 'prohibited_item');
    // Whole-word matching: "armoire" is not "arme".
    must(await seller.client.from('products').update({ title: 'Armoire en bois' }).eq('id', ok));
  });

  it("create_listing refuses media the caller did not upload (another user's file)", async () => {
    const othersFile = await uploadImage(other, 'public-media');
    expectError(await seller.client.rpc('create_listing', listingArgs(othersFile)), 'media_not_found');
    expectError(
      await seller.client.rpc('create_listing', listingArgs(`${seller.id}/does-not-exist.png`)),
      'media_not_found',
    );
    expectError(await seller.client.rpc('create_listing', { ...listingArgs(othersFile), p_media: [] }), 'media_required');
    // set_listing_media on someone else's product is refused too.
    expectError(
      await other.client.rpc('set_listing_media', { p_product_id: productId, p_media: [{ kind: 'image', path: othersFile }] }),
      'not_found',
    );
  });

  it('saving a product is private and updates save_count', async () => {
    const p = await createListing(seller, { title: 'Chaussures cuir' });
    must(await buyer.client.from('product_saves').insert({ user_id: buyer.id, product_id: p }));
    const row = must(await buyer.client.from('products').select('save_count').eq('id', p).single()) as any;
    expect(row.save_count).toBe(1);
    expectNoRowsAffected(await seller.client.from('product_saves').select('*').eq('product_id', p));
  });
});

describe('SOC-03 — discovery of a non-followed seller (browse_products / search_profiles)', () => {
  const tok = token(10);
  let seller: TestUser;
  let buyer: TestUser;
  let thiesProduct: string;
  let dakarProduct: string;

  beforeAll(async () => {
    [seller, buyer] = await Promise.all([
      createUser('seller', {
        displayName: `Couture Sénégal ${tok}`,
        profile: {
          city: 'Thiès',
          onboarded_at: new Date().toISOString(),
          is_merchant: true,
          boutique_name: `Couture Sénégal ${tok}`,
          boutique_category_slug: 'mode-femme',
        },
      }),
      createUser('buyer'),
    ]);
    thiesProduct = await createListing(seller, {
      title: `Boubou brodé bazin ${tok}`,
      category: 'mode-homme',
      city: 'Thiès',
      condition: 'like_new',
      price: 45000,
    });
    dakarProduct = await createListing(seller, {
      title: `Téléphone Tecno ${tok}`,
      category: 'telephones',
      city: 'Dakar',
      condition: 'good',
      price: 60000,
    });
  });

  const ids = (rows: any[]) => rows.map((r) => r.id);

  it('the buyer does not follow the seller', async () => {
    const rel = await rpc<Record<string, any>>(buyer.client, 'relationship_with', { p_target: seller.id });
    expect(rel.follow_status).toBeNull();
  });

  it('finds the listing by category', async () => {
    const rows = await rpc<any[]>(buyer.client, 'browse_products', { p_category: 'mode-homme', p_limit: 50 });
    expect(ids(rows)).toContain(thiesProduct);
    expect(ids(rows)).not.toContain(dakarProduct);
    for (const r of rows) expect(r.category_slug).toBe('mode-homme');
  });

  it('finds listings by city ("Dakar"), case-insensitively', async () => {
    for (const city of ['Dakar', 'dakar']) {
      const rows = await rpc<any[]>(buyer.client, 'browse_products', { p_city: city, p_query: tok });
      expect(ids(rows)).toEqual([dakarProduct]);
    }
    const all = await rpc<any[]>(buyer.client, 'browse_products', { p_city: 'Dakar', p_limit: 50 });
    expect(ids(all)).toContain(dakarProduct);
    expect(ids(all)).not.toContain(thiesProduct);
  });

  it('text and city search are accent-insensitive ("thies" matches "Thiès", "brode" matches "brodé")', async () => {
    let rows = await rpc<any[]>(buyer.client, 'browse_products', { p_query: 'thies', p_category: 'mode-homme', p_limit: 50 });
    expect(ids(rows)).toContain(thiesProduct);
    rows = await rpc<any[]>(buyer.client, 'browse_products', { p_city: 'thies', p_query: tok });
    expect(ids(rows)).toEqual([thiesProduct]);
    rows = await rpc<any[]>(buyer.client, 'browse_products', { p_query: `brode bazin ${tok}` });
    // Fuzzy matching may also return the seller's other item, but the exact match ranks first.
    expect(ids(rows)[0]).toBe(thiesProduct);
  });

  it('text search tolerates a typo', async () => {
    const typo = tok.slice(0, -1) + (tok.endsWith('x') ? 'y' : 'x');
    const rows = await rpc<any[]>(buyer.client, 'browse_products', { p_query: typo, p_limit: 50 });
    expect(ids(rows)).toContain(thiesProduct);
    const rows2 = await rpc<any[]>(buyer.client, 'browse_products', { p_query: `bazinn ${tok}` });
    expect(ids(rows2)).toContain(thiesProduct);
  });

  it('mode filters: occasions (used) and troc', async () => {
    const used = await rpc<any[]>(buyer.client, 'browse_products', { p_mode: 'occasions', p_query: tok });
    expect(ids(used).sort()).toEqual([thiesProduct, dakarProduct].sort());
    const troc = await rpc<any[]>(buyer.client, 'browse_products', { p_mode: 'troc', p_query: tok });
    expect(troc).toHaveLength(0);
  });

  it('search_profiles finds the seller by accent-free name and by city', async () => {
    let people = await rpc<any[]>(buyer.client, 'search_profiles', { p_query: `senegal ${tok}` });
    expect(ids(people)).toEqual([seller.id]);
    people = await rpc<any[]>(buyer.client, 'search_profiles', { p_query: tok, p_city: 'thies' });
    expect(ids(people)).toEqual([seller.id]);
    // Users who have not finished onboarding are not listed.
    const hidden = await createUser('notonboarded', { displayName: `Couture Sénégal ${tok} bis` });
    people = await rpc<any[]>(buyer.client, 'search_profiles', { p_query: tok });
    expect(ids(people)).not.toContain(hidden.id);
  });

  it('SOC-04: logged-out visitors can open the product and browse/search listings', async () => {
    const anon = anonClient();
    expect(await canSee(anon, 'products', thiesProduct)).toBe(true);
    const people = await anon.rpc('search_profiles', { p_query: tok });
    expect(people.error).toBeNull();
    expect(ids(people.data as any[])).toEqual([seller.id]);
    const res = await anon.rpc('browse_products', { p_query: tok });
    expect(res.error, res.error?.message).toBeNull();
    expect(ids(res.data as any[]).sort()).toEqual([thiesProduct, dakarProduct].sort());
  });
});
