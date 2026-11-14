/**
 * P1 identity — Waxaale voice offers (supabase/migrations/20261114000100_waxaale_voice_offer.sql):
 * the proposer of a pending offer may attach one voice note; it is an ordinary voice message of
 * the conversation, linked by offer_id, with every existing check (own file, audio, ≤ 180 s).
 * Nobody else can attach one, nor to a closed offer, nor twice; clients still cannot set offer_id.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createListing, createUser, expectError, expectPermissionDenied, must, rpc, token, type TestUser } from './helpers';

const WEBM_AUDIO = Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d', 'hex');

async function uploadVoice(user: TestUser): Promise<string> {
  const path = `${user.id}/audio/${token(12)}.webm`;
  const { error } = await user.client.storage.from('private-media').upload(path, new Blob([WEBM_AUDIO], { type: 'audio/webm' }), { contentType: 'audio/webm' });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

describe('attach_offer_voice', () => {
  let S: TestUser;
  let B: TestUser;
  let product: string;
  let offer: string;

  beforeAll(async () => {
    S = await createUser('WaxSeller', { onboarded: true });
    B = await createUser('WaxBuyer', { onboarded: true });
    product = await createListing(S, { title: `Téléphone ${token(6)}`, price: 60000 });
    offer = await rpc<string>(B.client, 'make_offer', { p_product_id: product, p_kind: 'price', p_amount_xof: 50000, p_message: '' });
  });

  it('the proposer attaches one voice note, visible to both members, linked to the offer', async () => {
    const path = await uploadVoice(B);
    const id = await rpc<string>(B.client, 'attach_offer_voice', { p_offer_id: offer, p_attachment_path: path, p_attachment_meta: { duration_ms: 6200, waveform: [10, 40, 90] } });
    for (const who of [B, S]) {
      const row = must(await who.client.from('messages').select('kind, offer_id, product_id, sender_id, attachment_path').eq('id', id).single()) as any;
      expect(row).toMatchObject({ kind: 'voice', offer_id: offer, product_id: product, sender_id: B.id, attachment_path: path });
    }
    expectError(
      await B.client.rpc('attach_offer_voice', { p_offer_id: offer, p_attachment_path: await uploadVoice(B), p_attachment_meta: { duration_ms: 3000 } }),
      'offer_voice_exists',
    );
  });

  it('only the proposer, only while pending, only their own audio ≤ 180 s', async () => {
    const p2 = await createListing(S, { title: `Téléphone ${token(6)} b`, price: 80000 });
    const o2 = await rpc<string>(B.client, 'make_offer', { p_product_id: p2, p_kind: 'price', p_amount_xof: 70000, p_message: '' });
    // The seller (recipient) cannot speak for the buyer's offer.
    expectError(await S.client.rpc('attach_offer_voice', { p_offer_id: o2, p_attachment_path: await uploadVoice(S), p_attachment_meta: { duration_ms: 3000 } }), 'not_allowed');
    // Someone else's file, a too-long note, a missing duration: refused by the message checks.
    const sellersFile = await uploadVoice(S);
    expectError(await B.client.rpc('attach_offer_voice', { p_offer_id: o2, p_attachment_path: sellersFile, p_attachment_meta: { duration_ms: 3000 } }), /media_not_found|check constraint/);
    expectError(await B.client.rpc('attach_offer_voice', { p_offer_id: o2, p_attachment_path: await uploadVoice(B), p_attachment_meta: { duration_ms: 181000 } }), 'audio_too_long');
    expectError(await B.client.rpc('attach_offer_voice', { p_offer_id: o2, p_attachment_path: await uploadVoice(B), p_attachment_meta: {} }), 'video_duration_required');
    // Once answered, no note can be added.
    must(await S.client.rpc('respond_offer', { p_offer_id: o2, p_accept: false }));
    expectError(await B.client.rpc('attach_offer_voice', { p_offer_id: o2, p_attachment_path: await uploadVoice(B), p_attachment_meta: { duration_ms: 3000 } }), 'invalid_transition');
  });

  it('clients still cannot link a message to an offer directly; anonymous callers are refused', async () => {
    const cid = (must(await B.client.from('offers').select('conversation_id').eq('id', offer).single()) as any).conversation_id;
    expectPermissionDenied(await B.client.from('messages').insert({ conversation_id: cid, sender_id: B.id, kind: 'text', body: 'x', offer_id: offer } as any));
    expectPermissionDenied(await anonClient().rpc('attach_offer_voice', { p_offer_id: offer, p_attachment_path: 'x', p_attachment_meta: {} }));
  });
});
