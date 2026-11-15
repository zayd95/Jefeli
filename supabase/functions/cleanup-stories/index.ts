/**
 * Maintenance: soft-delete expired, non-highlighted statuses and remove their files.
 * Visibility never depends on this job (RLS hides expired statuses at read time); it only
 * reclaims storage. Call with the service-role key (e.g. a scheduled trigger / cron).
 */
import { json } from '../_shared/http.ts';
import { admin, storage } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) return json({ error: 'unauthorized' }, 401);

  let rows: { storage_path: string; poster_path: string | null }[];
  try {
    rows = (await admin().rpc('purge_expired_stories', {})) ?? [];
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
  const paths = rows.flatMap((r) => [r.storage_path, r.poster_path]).filter((p): p is string => !!p);
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove('private-media', paths.slice(i, i + 100));
  }
  return json({ ok: true, statuses: rows.length, files: paths.length });
});
