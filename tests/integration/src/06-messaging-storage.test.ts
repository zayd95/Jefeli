import { beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  createListing,
  createUser,
  expectError,
  expectNoRowsAffected,
  expectPermissionDenied,
  expectRlsViolation,
  must,
  notificationsOf,
  rpc,
  sleep,
  subscribeInserts,
  trySignedUrl,
  uploadImage,
  waitFor,
  type TestUser,
} from './helpers';

describe('MSG-01 — product-linked conversation between buyer and seller', () => {
  let A: TestUser; // buyer
  let B: TestUser; // seller
  let C: TestUser; // outsider
  let productId: string;
  let cid: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    productId = await createListing(B, { title: 'Machine à coudre Singer', price: 70000 });
  });

  it('A contacts the seller from the listing; B sees the conversation with the product card', async () => {
    cid = await rpc<string>(A.client, 'message_about_product', { p_product_id: productId, p_body: 'Bonjour, toujours dispo ?' });
    const convs = await rpc<any[]>(B.client, 'my_conversations');
    const conv = convs.find((c) => c.conversation_id === cid);
    expect(conv).toMatchObject({ other_user_id: A.id, last_message_preview: 'Bonjour, toujours dispo ?', last_message_sender_id: A.id });

    const msgs = must(await B.client.from('messages').select('kind, product_id, sender_id').eq('conversation_id', cid)) as any[];
    expect(msgs).toHaveLength(2);
    expect(msgs).toContainEqual({ kind: 'product', product_id: productId, sender_id: A.id });
    expect(msgs).toContainEqual({ kind: 'text', product_id: null, sender_id: A.id });
    // Push copy never contains the message body (lock-screen privacy).
    const notifs = await notificationsOf(B, 'message');
    expect(notifs.length).toBeGreaterThan(0);
    expect(JSON.stringify(notifs)).not.toContain('toujours dispo');
    // The seller cannot "contact themselves" about their own item.
    expectError(await B.client.rpc('message_about_product', { p_product_id: productId }), 'own_product');
  });

  it("the buyer's first-contact messages count as unread for the seller", async () => {
    const conv = (await rpc<any[]>(B.client, 'my_conversations')).find((c) => c.conversation_id === cid);
    expect(conv.unread_count).toBe(2);
    expect(await rpc<number>(B.client, 'unread_messages_count')).toBe(2);
    // ...and the product card is ordered before the text sent with it.
    const ordered = must(
      await B.client.from('messages').select('kind').eq('conversation_id', cid).order('created_at').order('id'),
    ) as any[];
    const first = must(await B.client.from('messages').select('created_at').eq('conversation_id', cid)) as any[];
    expect(new Set(first.map((m) => m.created_at)).size, 'messages need distinct timestamps').toBe(2);
    expect(ordered.map((m) => m.kind)).toEqual(['product', 'text']);
  });

  it('B replies and marks the conversation read', async () => {
    must(await B.client.from('messages').insert({ conversation_id: cid, sender_id: B.id, body: 'Oui, elle est dispo.' }));
    must(
      await B.client
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', cid)
        .eq('user_id', B.id),
    );
    const convB = (await rpc<any[]>(B.client, 'my_conversations')).find((c) => c.conversation_id === cid);
    expect(convB.unread_count).toBe(0);
    const convA = (await rpc<any[]>(A.client, 'my_conversations')).find((c) => c.conversation_id === cid);
    expect(convA).toMatchObject({ unread_count: 1, last_message_preview: 'Oui, elle est dispo.', last_message_sender_id: B.id });
    // A member cannot change another member's read state.
    expectNoRowsAffected(
      await A.client
        .from('conversation_members')
        .update({ muted: true })
        .eq('conversation_id', cid)
        .eq('user_id', B.id)
        .select(),
    );
  });

  it('outsider C cannot read the conversation, its members or its messages', async () => {
    expect(must(await C.client.from('conversations').select('*').eq('id', cid))).toHaveLength(0);
    expect(must(await C.client.from('conversation_members').select('*').eq('conversation_id', cid))).toHaveLength(0);
    expect(must(await C.client.from('messages').select('*').eq('conversation_id', cid))).toHaveLength(0);
    expect((await rpc<any[]>(C.client, 'my_conversations')).map((c) => c.conversation_id)).not.toContain(cid);
    expectPermissionDenied(await anonClient().from('messages').select('*').eq('conversation_id', cid));
  });

  it('outsider C cannot write into the conversation (as self or impersonating a member)', async () => {
    expectRlsViolation(await C.client.from('messages').insert({ conversation_id: cid, sender_id: C.id, body: 'Intrus' }));
    expectRlsViolation(await C.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body: 'Faux A' }));
    expectPermissionDenied(await C.client.from('conversation_members').insert({ conversation_id: cid, user_id: C.id }));
    expectPermissionDenied(await C.client.from('conversations').insert({ direct_key: `${C.id}:${B.id}` }));
    const count = must(await A.client.from('messages').select('id').eq('conversation_id', cid)) as any[];
    expect(count).toHaveLength(3);
  });

  it("members cannot impersonate each other or insert 'offer' / 'system' / 'story_reply' messages", async () => {
    expectRlsViolation(await A.client.from('messages').insert({ conversation_id: cid, sender_id: B.id, body: 'Faux B' }));
    for (const kind of ['offer', 'system', 'story_reply']) {
      expectRlsViolation(
        await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, kind, body: 'offer_accepted' }),
      );
    }
    // offer_id / story_id are not client-writable columns at all.
    expectPermissionDenied(
      await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body: 'x', offer_id: crypto.randomUUID() }),
    );
  });

  it('private-media attachments are readable by members only', async () => {
    const path = await uploadImage(A, 'private-media');
    must(
      await A.client
        .from('messages')
        .insert({ conversation_id: cid, sender_id: A.id, kind: 'image', attachment_path: path }),
    );
    const urlB = await trySignedUrl(B.client, 'private-media', path);
    expect(urlB).toBeTruthy();
    expect((await fetch(urlB!)).status).toBe(200);
    expect(await trySignedUrl(C.client, 'private-media', path)).toBeNull();
    expect(await trySignedUrl(anonClient(), 'private-media', path)).toBeNull();
    expect((await C.client.storage.from('private-media').download(path)).error).toBeTruthy();
  });

  it('attachments must be files the sender really uploaded', async () => {
    expectError(
      await A.client
        .from('messages')
        .insert({ conversation_id: cid, sender_id: A.id, kind: 'image', attachment_path: `${A.id}/nope.png` }),
      'media_not_found',
    );
    const bFile = await uploadImage(B, 'private-media');
    const res = await A.client
      .from('messages')
      .insert({ conversation_id: cid, sender_id: A.id, kind: 'image', attachment_path: bFile });
    expect(res.error).toBeTruthy();
    expectError(
      await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, kind: 'image' }),
      'attachment_required',
    );
  });

  it('deleting a message clears its content (and attachment access) for both members', async () => {
    const path = await uploadImage(A, 'private-media');
    const msg = must(
      await A.client
        .from('messages')
        .insert({ conversation_id: cid, sender_id: A.id, kind: 'image', attachment_path: path, body: 'Photo du reçu' })
        .select('id')
        .single(),
    ) as any;
    expect(await trySignedUrl(B.client, 'private-media', path)).toBeTruthy();

    // B cannot delete A's message; A cannot rewrite its body.
    expectNoRowsAffected(
      await B.client.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id).select(),
    );
    expectPermissionDenied(await A.client.from('messages').update({ body: 'modifié' }).eq('id', msg.id));

    must(await A.client.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id));
    const seen = must(
      await B.client.from('messages').select('body, attachment_path, deleted_at').eq('id', msg.id).single(),
    ) as any;
    expect(seen.body).toBe('');
    expect(seen.attachment_path).toBeNull();
    expect(seen.deleted_at).toBeTruthy();
    expect(await trySignedUrl(B.client, 'private-media', path)).toBeNull();
    // A deleted message cannot be "undeleted".
    expect((await A.client.from('messages').update({ deleted_at: null }).eq('id', msg.id)).error).toBeTruthy();
  });

  it('deleting the latest message also removes its text from the conversation preview', async () => {
    const secret = 'Mon numéro perso : 77 000 00 00';
    const msg = must(
      await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body: secret }).select('id').single(),
    ) as any;
    let convB = (await rpc<any[]>(B.client, 'my_conversations')).find((c) => c.conversation_id === cid);
    expect(convB.last_message_preview).toBe(secret);

    must(await A.client.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id));
    convB = (await rpc<any[]>(B.client, 'my_conversations')).find((c) => c.conversation_id === cid);
    expect(convB.last_message_preview).not.toContain('77 000 00 00');
    const conv = must(await B.client.from('conversations').select('last_message_preview').eq('id', cid).single()) as any;
    expect(conv.last_message_preview).not.toContain('77 000 00 00');
  });

  it('get_or_create_conversation is idempotent and respects allow_messages_from', async () => {
    expect(await rpc<string>(B.client, 'get_or_create_conversation', { p_other: A.id })).toBe(cid);
    must(await C.client.from('account_settings').update({ allow_messages_from: 'friends' }).eq('user_id', C.id));
    expectError(await A.client.rpc('get_or_create_conversation', { p_other: C.id }), 'messages_restricted');
    expectError(await A.client.rpc('get_or_create_conversation', { p_other: A.id }), 'invalid_target');
  });
});

describe('Realtime — postgres_changes on messages honour RLS', () => {
  it('member B receives the insert; outsider C (live subscription) receives nothing from that conversation', async () => {
    const [A, B, C, D] = await Promise.all([createUser('rtA'), createUser('rtB'), createUser('rtC'), createUser('rtD')]);
    const cid = await rpc<string>(A.client, 'get_or_create_conversation', { p_other: B.id });
    const controlCid = await rpc<string>(D.client, 'get_or_create_conversation', { p_other: C.id });
    // C listens to the very same conversation filter AND to every messages insert.
    const [subB, subCFiltered, subCAll] = await Promise.all([
      subscribeInserts(B, 'messages', `conversation_id=eq.${cid}`),
      subscribeInserts(C, 'messages', `conversation_id=eq.${cid}`),
      subscribeInserts(C, 'messages'),
    ]);

    const body = `Message temps réel ${Date.now()}`;
    must(await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body }));
    // Control: C's subscription is live and receives messages of C's own conversation.
    must(await D.client.from('messages').insert({ conversation_id: controlCid, sender_id: D.id, body: 'Pour C' }));

    const got = await waitFor(async () => subB.events.find((e) => e.new?.body === body), 15_000);
    expect(got.new.conversation_id).toBe(cid);
    expect(got.new.sender_id).toBe(A.id);
    await waitFor(async () => subCAll.events.find((e) => e.new?.conversation_id === controlCid), 15_000);
    await sleep(2_000); // give a leaking server ample time to (wrongly) deliver to C
    expect(subCFiltered.events).toHaveLength(0);
    expect(subCAll.events.filter((e) => e.new?.conversation_id === cid)).toHaveLength(0);
  });
});

describe('Realtime — notifications are delivered to their recipient only', () => {
  it('B receives their notification; C (live subscription) never receives B\'s', async () => {
    const [A, B, C] = await Promise.all([createUser('nA'), createUser('nB'), createUser('nC')]);
    const [subB, subCFiltered, subCAll] = await Promise.all([
      subscribeInserts(B, 'notifications', `recipient_id=eq.${B.id}`),
      subscribeInserts(C, 'notifications', `recipient_id=eq.${B.id}`),
      subscribeInserts(C, 'notifications'),
    ]);
    must(await A.client.from('follows').insert({ follower_id: A.id, followee_id: B.id }));
    must(await A.client.from('follows').insert({ follower_id: A.id, followee_id: C.id })); // control for C
    const got = await waitFor(async () => subB.events.find((e) => e.new?.type === 'follow'), 15_000);
    expect(got.new.actor_id).toBe(A.id);
    await waitFor(async () => subCAll.events.find((e) => e.new?.recipient_id === C.id), 15_000);
    await sleep(2_000);
    expect(subCFiltered.events).toHaveLength(0);
    expect(subCAll.events.filter((e) => e.new?.recipient_id !== C.id)).toHaveLength(0);
  });
});

describe('Message rate limit', () => {
  it('a burst of messages eventually returns rate_limited', async () => {
    const [A, B] = await Promise.all([createUser('spamA'), createUser('spamB')]);
    const cid = await rpc<string>(A.client, 'get_or_create_conversation', { p_other: B.id });
    let limited: string | null = null;
    for (let i = 0; i < 90 && !limited; i++) {
      const res = await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, body: `spam ${i}` });
      if (res.error) limited = res.error.message;
    }
    expect(limited).toBe('rate_limited');
  });
});
