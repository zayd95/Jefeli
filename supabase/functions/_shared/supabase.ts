/**
 * Minimal, dependency-free Supabase REST client for Edge Functions (PostgREST, Auth,
 * Storage). Two modes:
 *   - admin(): service role — bypasses RLS; never return its data unfiltered to callers
 *   - asUser(jwt): the caller's own token — RLS applies exactly as in the apps
 */
const URL_BASE = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export class RestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface Db {
  select<T = Record<string, unknown>>(table: string, query: string): Promise<T[]>;
  maybeOne<T = Record<string, unknown>>(table: string, query: string): Promise<T | null>;
  insert<T = Record<string, unknown>>(table: string, row: Record<string, unknown>): Promise<T>;
  update(table: string, filter: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
}

function makeDb(apikey: string, bearer: string): Db {
  const headers = (extra: Record<string, string> = {}) => ({
    apikey,
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
    ...extra,
  });
  async function req(path: string, init: RequestInit): Promise<unknown> {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, init);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new RestError((data as { message?: string })?.message ?? `rest_${res.status}`, res.status);
    return data;
  }
  return {
    async select(table, query) {
      return (await req(`${table}?${query}`, { headers: headers() })) as never;
    },
    async maybeOne(table, query) {
      const rows = (await req(`${table}?${query}&limit=1`, { headers: headers() })) as unknown[];
      return (rows[0] ?? null) as never;
    },
    async insert(table, row) {
      const rows = (await req(table, { method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) })) as unknown[];
      return rows[0] as never;
    },
    async update(table, filter, patch) {
      await req(`${table}?${filter}`, { method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) });
    },
    async remove(table, filter) {
      await req(`${table}?${filter}`, { method: 'DELETE', headers: headers({ Prefer: 'return=minimal' }) });
    },
    async rpc(fn, args) {
      return (await req(`rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(args) })) as never;
    },
  };
}

export function admin(): Db {
  return makeDb(SERVICE, SERVICE);
}

export function asUser(jwt: string): Db {
  return makeDb(ANON, jwt);
}

/** Resolve the calling user from `Authorization: Bearer <jwt>` via GoTrue, or null. */
export async function getCaller(req: Request): Promise<{ id: string; jwt: string; db: Db } | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const jwt = auth.slice('Bearer '.length);
  const res = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; role?: string };
  if (!user.id) return null;
  return { id: user.id, jwt, db: asUser(jwt) };
}

export async function adminDeleteUser(id: string): Promise<void> {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  if (!res.ok) throw new RestError(`delete_user_${res.status}`, res.status);
}

export const storage = {
  async list(bucket: string, prefix: string): Promise<{ name: string; id: string | null }[]> {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!res.ok) return [];
    return (await res.json()) as { name: string; id: string | null }[];
  },
  async remove(bucket: string, paths: string[]): Promise<boolean> {
    if (!paths.length) return true;
    const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths }),
    });
    return res.ok;
  },
};
