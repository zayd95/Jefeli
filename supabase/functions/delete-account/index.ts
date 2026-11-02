/**
 * In-app account deletion (required by Apple/Google for apps with accounts).
 * The caller can only delete THEMSELVES: identity comes from their verified JWT.
 * Removes their uploaded files in every bucket, then the auth user (cascades to profile,
 * content, follows, messages, offers… through foreign keys).
 */
import { json, preflight } from '../_shared/http.ts';
import { adminDeleteUser, getCaller, storage } from '../_shared/supabase.ts';

const BUCKETS = ['avatars', 'public-media', 'private-media'];

async function listAll(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  if (depth > 4) return out;
  for (const item of await storage.list(bucket, prefix)) {
    const path = `${prefix}/${item.name}`;
    // Folders have no id in the storage list API.
    if (!item.id) out.push(...(await listAll(bucket, path, depth + 1)));
    else out.push(path);
  }
  return out;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const caller = await getCaller(req);
  if (!caller) return json({ error: 'not_authenticated' }, 401);
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (body.confirm !== true) return json({ error: 'confirmation_required' }, 400);

  let removed = 0;
  for (const bucket of BUCKETS) {
    const paths = await listAll(bucket, caller.id);
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      if (await storage.remove(bucket, chunk)) removed += chunk.length;
    }
  }
  try {
    await adminDeleteUser(caller.id);
  } catch (e) {
    console.error('delete_user_failed', String(e));
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ ok: true, files_removed: removed });
});
