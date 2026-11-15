/**
 * W1 web beta: « Donner mon avis ». Members write feedback; only staff read it; nobody can forge
 * the author, read others' feedback or flood the table. Deleting the account deletes it.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { adminClient, anonClient, createUser, expectError, must, rpc, type TestUser } from './helpers';

describe('feedback', () => {
  let A: TestUser;
  let B: TestUser;
  let M: TestUser;

  beforeAll(async () => {
    A = await createUser('fb_a');
    B = await createUser('fb_b');
    M = await createUser('fb_mod', { staffRole: 'moderator' });
  });

  it('a member sends feedback; it is stored as theirs, new, on the web', async () => {
    must(await A.client.from('feedback').insert({ kind: 'problem', message: 'Le bouton Envoyer ne répond pas.', platform: 'web' }));
    const rows = must(await adminClient.from('feedback').select('*').eq('user_id', A.id)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'problem', status: 'new', platform: 'web' });
  });

  it('the author cannot be forged and the status cannot be set by a member', async () => {
    const forged = await A.client.from('feedback').insert({ kind: 'idea', message: 'Au nom de B', user_id: B.id } as never);
    expect(forged.error).not.toBeNull();
    const status = await A.client.from('feedback').insert({ kind: 'idea', message: 'Déjà traité ?', status: 'done' } as never);
    expect(status.error).not.toBeNull();
    expect(must(await adminClient.from('feedback').select('id').eq('user_id', B.id))).toHaveLength(0);
  });

  it('members cannot read feedback, not even their own; staff can, and can mark it done', async () => {
    must(await B.client.from('feedback').insert({ kind: 'unclear', message: 'Je ne trouve pas mes accords.', platform: 'web' }));
    expect(must(await A.client.from('feedback').select('id'))).toHaveLength(0);
    expect(must(await B.client.from('feedback').select('id'))).toHaveLength(0);
    const seen = must(await M.client.from('feedback').select('id, user_id, message').in('user_id', [A.id, B.id])) ?? [];
    expect(seen.map((r) => r.user_id).sort()).toEqual([A.id, B.id].sort());
    const id = seen.find((r) => r.user_id === B.id)!.id;
    must(await M.client.from('feedback').update({ status: 'done' }).eq('id', id));
    expect(must(await adminClient.from('feedback').select('status').eq('id', id).single())?.status).toBe('done');
    // A member's update touches nothing.
    must(await A.client.from('feedback').update({ status: 'new' }).eq('id', id));
    expect(must(await adminClient.from('feedback').select('status').eq('id', id).single())?.status).toBe('done');
  });

  it('visitors cannot send feedback; empty, too long or unknown kinds are refused', async () => {
    const anon = await anonClient().from('feedback').insert({ kind: 'idea', message: 'Anonyme' });
    expect(anon.error).not.toBeNull();
    expectError(await A.client.from('feedback').insert({ kind: 'idea', message: '  ' }), /feedback_message_length/);
    expectError(await A.client.from('feedback').insert({ kind: 'idea', message: 'x'.repeat(1001) }), /feedback_message_length/);
    expect((await A.client.from('feedback').insert({ kind: 'spam', message: 'Bonjour' })).error).not.toBeNull();
  });

  it('is rate limited (10 per day per member)', async () => {
    const C = await createUser('fb_c');
    for (let i = 0; i < 10; i += 1) must(await C.client.from('feedback').insert({ kind: 'idea', message: `Idée numéro ${i}` }));
    expectError(await C.client.from('feedback').insert({ kind: 'idea', message: 'Une de trop' }), 'rate_limited');
  });

  it('appears in the member’s own data export, and goes when the account is deleted', async () => {
    const exported = await rpc<Record<string, any>>(A.client, 'export_my_data');
    expect(exported.feedback.map((f: { message: string }) => f.message)).toContain('Le bouton Envoyer ne répond pas.');
    expect(Object.keys(exported.feedback[0]).sort()).toEqual(['created_at', 'kind', 'message']);
    const D = await createUser('fb_d');
    must(await D.client.from('feedback').insert({ kind: 'other', message: 'Avant de partir' }));
    expect((await adminClient.auth.admin.deleteUser(D.id)).error).toBeNull();
    expect(must(await adminClient.from('feedback').select('id').eq('user_id', D.id))).toHaveLength(0);
  });
});
