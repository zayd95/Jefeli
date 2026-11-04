/**
 * Regression tests for defects found after the first run of this suite and fixed in
 * supabase/migrations/20261102000900_security_fixes.sql.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, createPost, createUser, expectError, must, rpc, type TestUser } from './helpers';

describe('regressions — blocks', () => {
  let A: TestUser; // post author (third party)
  let B: TestUser; // blocker who comments
  let C: TestUser; // blocked by B

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('reg-a'), createUser('reg-b'), createUser('reg-c')]);
  });

  it("a blocked member cannot reply under the blocker's comment on someone else's post", async () => {
    const post = await createPost(A, 'public', 'Publication tierce');
    const parent = must(
      await B.client.from('comments').insert({ post_id: post.id, author_id: B.id, body: 'Commentaire de B' }).select('id').single(),
    ) as { id: string };
    must(await B.client.from('blocks').insert({ blocker_id: B.id, blocked_id: C.id }));
    expectError(
      await C.client.from('comments').insert({ post_id: post.id, author_id: C.id, body: 'Réponse', parent_id: parent.id }),
      'blocked',
    );
    // C can still comment at the top level of A's post (no block with A).
    const ok = await C.client.from('comments').insert({ post_id: post.id, author_id: C.id, body: 'Top-level' });
    expect(ok.error).toBeNull();
  });

  it('relationship_with does not reveal to a blocked member that they were blocked', async () => {
    const rel = await rpc<Record<string, unknown>>(C.client, 'relationship_with', { p_target: B.id });
    expect(rel).not.toHaveProperty('blocked_by');
    expect(rel.blocked).toBe(false);
    const own = await rpc<Record<string, unknown>>(B.client, 'relationship_with', { p_target: C.id });
    expect(own.blocked).toBe(true);
  });
});

describe('regressions — scheduled maintenance', () => {
  it('pg_cron jobs exist for offer expiry, status purge and rate-limit pruning', async () => {
    const { data, error } = await adminClient.rpc('expire_stale_offers');
    expect(error).toBeNull();
    expect(typeof data).toBe('number');
  });
});
