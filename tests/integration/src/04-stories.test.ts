import { beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  anonClient,
  canSee,
  createStory,
  createUser,
  expectError,
  expectPermissionDenied,
  expectRlsViolation,
  follow,
  must,
  notificationsOf,
  rpc,
  trySignedUrl,
  type StoryFixture,
  type TestUser,
} from './helpers';

async function expireStory(id: string): Promise<void> {
  must(
    await adminClient
      .from('stories')
      .update({ expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq('id', id),
  );
}

describe('STA-01 — 24h status (followers audience)', () => {
  let A: TestUser; // follower
  let B: TestUser; // author
  let C: TestUser; // not a follower
  let story: StoryFixture;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    expect(await follow(A, B)).toBe('accepted');
    story = await createStory(B, 'followers', 'Arrivage du jour');
  });

  it('a follower sees it, a non-follower and an anonymous visitor do not', async () => {
    expect(await canSee(A.client, 'stories', story.id)).toBe(true);
    expect(await canSee(C.client, 'stories', story.id)).toBe(false);
    expect(await canSee(anonClient(), 'stories', story.id)).toBe(false);
  });

  it('the story media is readable by the follower only', async () => {
    const url = await trySignedUrl(A.client, 'private-media', story.mediaPath);
    expect(url).toBeTruthy();
    expect((await fetch(url!)).status).toBe(200);
    expect(await trySignedUrl(C.client, 'private-media', story.mediaPath)).toBeNull();
    expect(await trySignedUrl(anonClient(), 'private-media', story.mediaPath)).toBeNull();
  });

  it('the story rail of the follower lists the author', async () => {
    const rail = await rpc<any[]>(A.client, 'get_story_rail');
    const entry = rail.find((r) => r.author_id === B.id);
    expect(entry?.has_unseen).toBe(true);
    const railC = await rpc<any[]>(C.client, 'get_story_rail');
    expect(railC.map((r) => r.author_id)).not.toContain(B.id);
  });

  it('views are recorded by allowed viewers only and visible to the author', async () => {
    must(await A.client.from('story_views').insert({ story_id: story.id, viewer_id: A.id }));
    expectRlsViolation(await C.client.from('story_views').insert({ story_id: story.id, viewer_id: C.id }));
    expectRlsViolation(await A.client.from('story_views').insert({ story_id: story.id, viewer_id: C.id }));
    const views = must(await B.client.from('story_views').select('viewer_id').eq('story_id', story.id)) as any[];
    expect(views.map((v) => v.viewer_id)).toEqual([A.id]);
    // C cannot enumerate who viewed B's story.
    expect(must(await C.client.from('story_views').select('*').eq('story_id', story.id))).toHaveLength(0);
    const rail = await rpc<any[]>(A.client, 'get_story_rail');
    expect(rail.find((r) => r.author_id === B.id)?.has_unseen).toBe(false);
  });

  it('reply_to_story opens a private conversation with the author (kind story_reply)', async () => {
    const cid = await rpc<string>(A.client, 'reply_to_story', { p_story_id: story.id, p_body: 'Il reste des tailles M ?' });
    const msgs = must(await B.client.from('messages').select('*').eq('conversation_id', cid)) as any[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ kind: 'story_reply', sender_id: A.id, story_id: story.id, body: 'Il reste des tailles M ?' });
    const members = must(await B.client.from('conversation_members').select('user_id').eq('conversation_id', cid)) as any[];
    expect(members.map((m) => m.user_id).sort()).toEqual([A.id, B.id].sort());
    expect((await notificationsOf(B, 'story_reply')).map((n) => n.actor_id)).toContain(A.id);
    // Somebody who cannot see the story cannot reply to it.
    expectError(await C.client.rpc('reply_to_story', { p_story_id: story.id, p_body: 'Coucou' }), 'not_found');
    // Clients cannot fake a story_reply message directly.
    expectRlsViolation(
      await A.client.from('messages').insert({ conversation_id: cid, sender_id: A.id, kind: 'story_reply', body: 'x' }),
    );
  });

  it('stories are created only through create_story with an owned private file', async () => {
    expectPermissionDenied(
      await A.client.from('stories').insert({ author_id: A.id, media_kind: 'image', storage_path: `${A.id}/x.png`, audience: 'public' }),
    );
    expectError(
      await A.client.rpc('create_story', {
        p_media_kind: 'image', p_path: story.mediaPath, p_poster_path: null, p_width: 1, p_height: 1,
        p_duration_ms: null, p_caption: 'vol', p_audience: 'public', p_product_id: null,
      }),
      'media_not_found',
    );
    // Others cannot alter or remove B's story.
    expectPermissionDenied(await A.client.from('stories').update({ deleted_at: new Date().toISOString() }).eq('id', story.id));
    expectError(await A.client.rpc('delete_story', { p_story_id: story.id }), 'not_found');
    expect(await canSee(A.client, 'stories', story.id)).toBe(true);
  });

  it('the author can delete their own story, which disappears for followers', async () => {
    const extra = await createStory(B, 'followers', 'À supprimer');
    expect(await canSee(A.client, 'stories', extra.id)).toBe(true);
    const res = await B.client.rpc('delete_story', { p_story_id: extra.id });
    expect(res.error?.message ?? null).toBeNull();
    expect(await canSee(A.client, 'stories', extra.id)).toBe(false);
    expect(await trySignedUrl(A.client, 'private-media', extra.mediaPath)).toBeNull();
  });

  it('once expired (expires_at in the past) the story is no longer visible to the follower', async () => {
    await expireStory(story.id);
    expect(await canSee(A.client, 'stories', story.id)).toBe(false);
    expect(await trySignedUrl(A.client, 'private-media', story.mediaPath)).toBeNull();
    expectError(await A.client.rpc('reply_to_story', { p_story_id: story.id, p_body: 'Encore là ?' }), 'not_found');
    // The author still sees their own archive.
    expect(await canSee(B.client, 'stories', story.id)).toBe(true);
  });
});

describe('STA-02 — highlights keep an expired story visible per its audience', () => {
  let A: TestUser; // follower
  let B: TestUser; // author
  let C: TestUser; // not a follower
  let story: StoryFixture;
  let highlightId: string;

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createUser('A'), createUser('B'), createUser('C')]);
    expect(await follow(A, B)).toBe('accepted');
    story = await createStory(B, 'followers', 'Meilleures ventes');
  });

  it('B pins the story to a highlight', async () => {
    const h = must(
      await B.client.from('highlights').insert({ owner_id: B.id, title: 'Best-sellers' }).select('id').single(),
    ) as any;
    highlightId = h.id;
    must(await B.client.from('highlight_items').insert({ highlight_id: highlightId, story_id: story.id }));
    expect(must(await A.client.from('highlight_items').select('story_id').eq('highlight_id', highlightId))).toEqual([
      { story_id: story.id },
    ]);
  });

  it('after expiry, the highlighted story stays visible to the follower but not to others', async () => {
    await expireStory(story.id);
    expect(await canSee(A.client, 'stories', story.id)).toBe(true);
    expect(await trySignedUrl(A.client, 'private-media', story.mediaPath)).toBeTruthy();
    expect(await canSee(C.client, 'stories', story.id)).toBe(false);
    expect(await canSee(anonClient(), 'stories', story.id)).toBe(false);
  });

  it("C cannot add B's story to C's highlight, nor touch B's highlight", async () => {
    const hc = must(
      await C.client.from('highlights').insert({ owner_id: C.id, title: 'Vol' }).select('id').single(),
    ) as any;
    expectRlsViolation(await C.client.from('highlight_items').insert({ highlight_id: hc.id, story_id: story.id }));
    expectRlsViolation(await C.client.from('highlight_items').insert({ highlight_id: highlightId, story_id: story.id }));
    expectRlsViolation(await C.client.from('highlights').insert({ owner_id: B.id, title: 'Usurpation' }));
    const del = await C.client.from('highlight_items').delete().eq('highlight_id', highlightId).select();
    expect(del.data ?? []).toHaveLength(0);
    expect(await canSee(A.client, 'stories', story.id)).toBe(true);
  });

  it('logged-out visitors can load the story rail (get_story_rail is granted to anon)', async () => {
    const res = await anonClient().rpc('get_story_rail');
    expect(res.error, res.error?.message).toBeNull();
    expect((res.data as any[]).map((r) => r.author_id)).not.toContain(B.id);
  });
});
