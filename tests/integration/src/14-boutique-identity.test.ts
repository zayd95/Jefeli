/**
 * Optional boutique identity (owner's migration 20261106000100_optional_boutique_identity.sql and
 * the follow-up 20261106000200_boutique_identity_followup.sql).
 *
 * Anyone can post and list casually. Opting into the merchant identity (is_merchant, « Vendeur »)
 * requires only a shop name and a main category. Only the member can set them, and an admin's
 * verification approval never violates the rule.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminProfile, anonClient, createListing, createUser, expectError, expectNoRowsAffected, expectPermissionDenied, must, rpc, type TestUser } from './helpers';

const IDENTITY = 'profiles_boutique_identity_required';
const NAME_LENGTH = 'profiles_boutique_name_length';

describe('Boutique identity: required only for the merchant opt-in', () => {
  let casual: TestUser;
  let seller: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    [casual, seller, other] = await Promise.all([createUser('casual'), createUser('seller'), createUser('other')]);
  });

  it('a casual member lists an article without any boutique identity', async () => {
    const id = await createListing(casual, { title: 'Chaise en bois' });
    expect(id).toBeTruthy();
    const p = await adminProfile(casual.id);
    expect(p.is_merchant).toBe(false);
    expect(p.boutique_name).toBeNull();
    expect(p.boutique_category_slug).toBeNull();
  });

  it('opting in without a name or a category is refused', async () => {
    expectError(await seller.client.from('profiles').update({ is_merchant: true }).eq('id', seller.id), IDENTITY);
    expectError(await seller.client.from('profiles').update({ is_merchant: true, boutique_name: 'Seynabou Mode' }).eq('id', seller.id), IDENTITY);
    expectError(await seller.client.from('profiles').update({ is_merchant: true, boutique_category_slug: 'mode-femme' }).eq('id', seller.id), IDENTITY);
    expectError(
      await seller.client.from('profiles').update({ is_merchant: true, boutique_name: '   ', boutique_category_slug: 'mode-femme' }).eq('id', seller.id),
      /profiles_boutique_(identity_required|name_length)/,
    );
    expect((await adminProfile(seller.id)).is_merchant).toBe(false);
  });

  it('a name of 2 to 60 characters and an existing category are enough', async () => {
    expectError(await seller.client.from('profiles').update({ boutique_name: 'S' }).eq('id', seller.id), NAME_LENGTH);
    expectError(await seller.client.from('profiles').update({ boutique_name: 'x'.repeat(61) }).eq('id', seller.id), NAME_LENGTH);
    const unknown = await seller.client.from('profiles').update({ boutique_category_slug: 'pas-une-categorie' }).eq('id', seller.id);
    expect(unknown.error?.code).toBe('23503'); // foreign key to categories
    must(
      await seller.client
        .from('profiles')
        .update({ is_merchant: true, boutique_name: 'Seynabou Mode', boutique_category_slug: 'mode-femme' })
        .eq('id', seller.id),
    );
    const p = await adminProfile(seller.id);
    expect(p.is_merchant).toBe(true);
    expect(p.boutique_name).toBe('Seynabou Mode');
  });

  it('a merchant cannot clear the name or category while keeping « Vendeur »; switching it off first works', async () => {
    expectError(await seller.client.from('profiles').update({ boutique_name: null }).eq('id', seller.id), IDENTITY);
    expectError(await seller.client.from('profiles').update({ boutique_category_slug: null }).eq('id', seller.id), IDENTITY);
    must(await seller.client.from('profiles').update({ is_merchant: false }).eq('id', seller.id));
    must(await seller.client.from('profiles').update({ boutique_name: null, boutique_category_slug: null }).eq('id', seller.id));
    must(
      await seller.client
        .from('profiles')
        .update({ is_merchant: true, boutique_name: 'Seynabou Mode', boutique_category_slug: 'mode-femme' })
        .eq('id', seller.id),
    );
  });

  it('only the member sets their boutique identity; visitors can read it on the public profile', async () => {
    expectNoRowsAffected(await other.client.from('profiles').update({ boutique_name: 'Piratée' }).eq('id', seller.id).select('id'));
    expectPermissionDenied(await anonClient().from('profiles').update({ boutique_name: 'Piratée' }).eq('id', seller.id));
    const visible = must(await anonClient().from('profiles').select('boutique_name, boutique_category_slug').eq('id', seller.id).single()) as {
      boutique_name: string;
      boutique_category_slug: string;
    };
    expect(visible).toEqual({ boutique_name: 'Seynabou Mode', boutique_category_slug: 'mode-femme' });
  });
});

describe('Merchant verification approval respects the boutique identity rule', () => {
  let member: TestUser;
  let AD: TestUser;

  beforeAll(async () => {
    [member, AD] = await Promise.all([createUser('verif'), createUser('AD-verif', { staffRole: 'admin' })]);
  });

  it('approving a member with no category grants the badge, names the boutique, and leaves « Vendeur » off', async () => {
    const req = must(
      await member.client
        .from('verification_requests')
        .insert({ user_id: member.id, business_name: '  Atelier Ndèye  ', business_type: 'artisan' })
        .select('id')
        .single(),
    ) as { id: string };
    await rpc(AD.client, 'review_verification_request', { p_request_id: req.id, p_approve: true, p_note: 'Documents vérifiés' });
    const p = await adminProfile(member.id);
    expect(p.verification_level).toBe('merchant_verified');
    expect(p.boutique_name).toBe('Atelier Ndèye');
    expect(p.is_merchant).toBe(false);
  });

  it('the member then opts in by choosing a category; the verified name is kept', async () => {
    must(await member.client.from('profiles').update({ is_merchant: true, boutique_category_slug: 'artisanat' }).eq('id', member.id));
    const p = await adminProfile(member.id);
    expect(p.is_merchant).toBe(true);
    expect(p.boutique_name).toBe('Atelier Ndèye');
  });
});
