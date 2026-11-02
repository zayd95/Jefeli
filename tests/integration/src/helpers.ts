import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { expect } from 'vitest';
import { SUPABASE_ANON_KEY, SUPABASE_DB_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env';

// The suite talks to PostgREST with untyped clients on purpose: many cases send payloads
// the generated types would (rightly) reject, to prove the database rejects them too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Client = SupabaseClient<any, 'public', any>;

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Service-role client: bypasses RLS. Only for arranging fixtures and checking ground truth. */
export const adminClient: Client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientOptions);

/** A fresh, signed-out client (the `anon` role). */
export function anonClient(): Client {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);
}

/** Short random token, lowercase letters only (safe for handles and trigram search). */
export function token(length = 10): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export const RUN_ID = token(6);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------
// Cleanup bookkeeping (users + uploaded files are removed after each test file unless
// KEEP_TEST_DATA=1).
// ---------------------------------------------------------------------------------------

const createdUserIds: string[] = [];
const uploadedObjects: { bucket: string; path: string }[] = [];
const openClients: Client[] = [];

export async function cleanupCreatedData(): Promise<void> {
  for (const c of openClients.splice(0)) {
    try {
      await c.removeAllChannels();
    } catch {
      /* ignore */
    }
  }
  if (process.env.KEEP_TEST_DATA === '1') return;
  const byBucket = new Map<string, string[]>();
  for (const o of uploadedObjects.splice(0)) {
    byBucket.set(o.bucket, [...(byBucket.get(o.bucket) ?? []), o.path]);
  }
  for (const [bucket, paths] of byBucket) {
    await adminClient.storage.from(bucket).remove(paths);
  }
  for (const id of createdUserIds.splice(0)) {
    await adminClient.from('staff_roles').delete().eq('user_id', id);
    await adminClient.auth.admin.deleteUser(id);
  }
}

// ---------------------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  label: string;
  accessToken: string;
  client: Client;
}

export interface CreateUserOptions {
  displayName?: string;
  handle?: string;
  /** Profile columns the user sets on themselves after sign-in (as `authenticated`). */
  profile?: Record<string, unknown>;
  staffRole?: 'admin' | 'moderator';
}

/**
 * Creates a confirmed auth user with the service role (the profile + settings rows are
 * created by the `on_auth_user_created` trigger), then signs in with a separate anon client.
 */
export async function createUser(label: string, opts: CreateUserOptions = {}): Promise<TestUser> {
  const email = `it-${RUN_ID}-${label.toLowerCase().replace(/[^a-z0-9]/g, '')}-${token(6)}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const metadata: Record<string, string> = {};
  if (opts.displayName) metadata.display_name = opts.displayName;
  if (opts.handle) metadata.handle = opts.handle;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  const id = data.user.id;
  createdUserIds.push(id);

  if (opts.staffRole) {
    const { error: roleErr } = await adminClient.from('staff_roles').insert({ user_id: id, role: opts.staffRole });
    if (roleErr) throw new Error(`staff role for ${label} failed: ${roleErr.message}`);
  }

  const client = anonClient();
  openClients.push(client);
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr || !session.session) throw new Error(`signIn(${label}) failed: ${signInErr?.message}`);

  if (opts.profile) {
    const { error: profErr } = await client.from('profiles').update(opts.profile).eq('id', id);
    if (profErr) throw new Error(`profile setup for ${label} failed: ${profErr.message}`);
  }
  return { id, email, label, accessToken: session.session.access_token, client };
}

/** Ground truth for a profile row, read with the service role. */
export async function adminProfile(id: string): Promise<Record<string, any>> {
  const row = must(await adminClient.from('profiles').select('*').eq('id', id).single());
  if (!row) throw new Error(`profile ${id} not found`);
  return row as Record<string, any>;
}

// ---------------------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------------------

interface PgResult<T> {
  data: T;
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null;
}

/** Unwraps a supabase-js result, failing the test with the server message on error. */
export function must<T>(res: PgResult<T>, context = ''): T {
  if (res.error) {
    throw new Error(`Unexpected error${context ? ` (${context})` : ''}: ${res.error.code ?? ''} ${res.error.message}`);
  }
  return res.data;
}

/** Asserts the call failed with a server error whose message contains `key` (e.g. 'blocked'). */
export function expectError(res: PgResult<unknown>, key: string | RegExp): void {
  expect(res.error, `expected an error matching ${String(key)}, got data ${JSON.stringify(res.data)}`).toBeTruthy();
  if (typeof key === 'string') expect(res.error!.message).toContain(key);
  else expect(res.error!.message).toMatch(key);
}

/** Missing GRANT (table, column or function): Postgres 42501 "permission denied ...". */
export function expectPermissionDenied(res: PgResult<unknown>): void {
  expect(res.error, `expected permission denied, got data ${JSON.stringify(res.data)}`).toBeTruthy();
  expect(res.error!.code).toBe('42501');
  expect(res.error!.message).toMatch(/permission denied/i);
}

/** RLS WITH CHECK failure on insert/update: 42501 "new row violates row-level security policy". */
export function expectRlsViolation(res: PgResult<unknown>): void {
  expect(res.error, `expected an RLS violation, got data ${JSON.stringify(res.data)}`).toBeTruthy();
  expect(res.error!.code).toBe('42501');
  expect(res.error!.message).toMatch(/row-level security/i);
}

/** An UPDATE/DELETE silently filtered by RLS: no error, zero rows touched. */
export function expectNoRowsAffected(res: PgResult<unknown[] | null>): void {
  expect(res.error).toBeNull();
  expect(res.data ?? []).toHaveLength(0);
}

export async function rpc<T = any>(client: Client, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return must(await client.rpc(fn, args), fn) as T;
}

/** Polls `fn` until it returns a truthy value (or throws after `timeoutMs`). */
export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 10_000, everyMs = 250): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await sleep(everyMs);
  }
}

// ---------------------------------------------------------------------------------------
// Storage & content fixtures
// ---------------------------------------------------------------------------------------

/** A real 1×1 PNG. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export type Bucket = 'avatars' | 'public-media' | 'private-media';

/** Uploads a tiny PNG as `user` into `{user.id}/...` and returns the object path. */
export async function uploadImage(user: TestUser, bucket: Bucket = 'public-media', name?: string): Promise<string> {
  const path = `${user.id}/${name ?? `${token(12)}.png`}`;
  const { error } = await user.client.storage
    .from(bucket)
    .upload(path, new Blob([PNG_1X1], { type: 'image/png' }), { contentType: 'image/png', upsert: false });
  if (error) throw new Error(`upload ${bucket}/${path} failed: ${error.message}`);
  uploadedObjects.push({ bucket, path });
  return path;
}

export function mediaJson(path: string) {
  return [{ kind: 'image', path, width: 1, height: 1 }];
}

export interface ListingInput {
  title?: string;
  description?: string;
  price?: number | null;
  category?: string;
  condition?: string;
  mode?: 'sale' | 'trade' | 'sale_or_trade';
  city?: string | null;
  neighborhood?: string | null;
  mediaPath?: string;
}

export function listingArgs(mediaPath: string, input: ListingInput = {}): Record<string, unknown> {
  return {
    p_title: input.title ?? `Article test ${token(5)}`,
    p_description: input.description ?? '',
    p_price_xof: input.price === undefined ? 25000 : input.price,
    p_category_slug: input.category ?? 'autres',
    p_condition: input.condition ?? 'good',
    p_listing_mode: input.mode ?? 'sale',
    p_quantity: 1,
    p_city: input.city === undefined ? 'Dakar' : input.city,
    p_neighborhood: input.neighborhood ?? null,
    p_delivery_options: ['pickup'],
    p_delivery_notes: '',
    p_media: mediaJson(mediaPath),
  };
}

/** Uploads an image and calls `create_listing` as `user`. Returns the product id. */
export async function createListing(user: TestUser, input: ListingInput = {}): Promise<string> {
  const path = input.mediaPath ?? (await uploadImage(user, 'public-media'));
  return rpc<string>(user.client, 'create_listing', listingArgs(path, input));
}

export interface PostFixture {
  id: string;
  mediaPath: string;
  bucket: Bucket;
}

/** Uploads an image into the bucket matching the audience and calls `create_post`. */
export async function createPost(
  user: TestUser,
  visibility: 'public' | 'followers' | 'friends' = 'public',
  body = `Publication ${token(6)}`,
): Promise<PostFixture> {
  const bucket: Bucket = visibility === 'public' ? 'public-media' : 'private-media';
  const mediaPath = await uploadImage(user, bucket);
  const id = await rpc<string>(user.client, 'create_post', {
    p_body: body,
    p_visibility: visibility,
    p_media: mediaJson(mediaPath),
    p_product_ids: [],
  });
  return { id, mediaPath, bucket };
}

export interface StoryFixture {
  id: string;
  mediaPath: string;
}

/** Uploads an image into private-media and calls `create_story`. */
export async function createStory(
  user: TestUser,
  audience: 'public' | 'followers' | 'friends' = 'followers',
  caption = 'Nouveau statut',
): Promise<StoryFixture> {
  const mediaPath = await uploadImage(user, 'private-media');
  const id = await rpc<string>(user.client, 'create_story', {
    p_media_kind: 'image',
    p_path: mediaPath,
    p_poster_path: null,
    p_width: 1,
    p_height: 1,
    p_duration_ms: null,
    p_caption: caption,
    p_audience: audience,
    p_product_id: null,
  });
  return { id, mediaPath };
}

/** `follower` follows `followee` (public account → accepted immediately). */
export async function follow(follower: TestUser, followee: TestUser): Promise<string> {
  const row = must(
    await follower.client
      .from('follows')
      .insert({ follower_id: follower.id, followee_id: followee.id })
      .select('status')
      .single(),
    'follow',
  ) as { status: string };
  return row.status;
}

/** Makes `a` and `b` friends through the real RPCs. */
export async function makeFriends(a: TestUser, b: TestUser): Promise<void> {
  const status = await rpc<string>(a.client, 'send_friend_request', { p_target: b.id });
  expect(status).toBe('pending');
  const req = must(
    await b.client.from('friend_requests').select('id').eq('sender_id', a.id).eq('status', 'pending').single(),
  ) as { id: string };
  expect(await rpc<string>(b.client, 'respond_friend_request', { p_request_id: req.id, p_accept: true })).toBe('accepted');
}

/** Can `client` read the row `id` of `table` (RLS SELECT)? */
export async function canSee(client: Client, table: string, id: string, idColumn = 'id'): Promise<boolean> {
  const { data, error } = await client.from(table).select(idColumn).eq(idColumn, id);
  if (error) return false;
  return (data ?? []).length > 0;
}

/** Tries to mint a signed URL for a private object; returns the URL or null when refused. */
export async function trySignedUrl(client: Client, bucket: Bucket, path: string): Promise<string | null> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Notifications of `user` (read as that user, through RLS). */
export async function notificationsOf(user: TestUser, type?: string): Promise<Record<string, any>[]> {
  let q = user.client.from('notifications').select('*').eq('recipient_id', user.id);
  if (type) q = q.eq('type', type);
  return must(await q.order('created_at', { ascending: false })) as Record<string, any>[];
}

// ---------------------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------------------

export interface Subscription {
  events: Record<string, any>[];
  channel: RealtimeChannel;
}

/**
 * Subscribes `user` to postgres_changes INSERT events on `table` (optionally filtered) with
 * the user's own JWT, and resolves once the server confirmed the postgres_changes binding.
 */
export async function subscribeInserts(user: TestUser, table: string, filter?: string): Promise<Subscription> {
  await user.client.realtime.setAuth(user.accessToken);
  const events: Record<string, any>[] = [];
  let pgReady = false;
  const channel = user.client
    .channel(`it-${table}-${token(8)}`)
    .on('system', {}, (payload: Record<string, any>) => {
      if (payload?.extension === 'postgres_changes' && payload?.status === 'ok') pgReady = true;
    })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => events.push(payload as Record<string, any>),
    );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`realtime subscribe timeout for ${user.label}`)), 20_000);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer);
        reject(err ?? new Error(`realtime ${status} for ${user.label}`));
      }
    });
  });
  // Wait for the "Subscribed to PostgreSQL" system ack (falls back after a few seconds).
  const start = Date.now();
  while (!pgReady && Date.now() - start < 8_000) await sleep(100);
  return { events, channel };
}

// ---------------------------------------------------------------------------------------
// Direct SQL (only for catalog checks that PostgREST cannot express). Uses the local psql.
// ---------------------------------------------------------------------------------------

export function hasPsql(): boolean {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function psql(query: string): string {
  return execFileSync('psql', [SUPABASE_DB_URL, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
  }).trim();
}
