/**
 * Maintenance (W1.1): remove files that nothing references any more — uploads abandoned before
 * publishing, media of deleted publications/listings/statuses, replaced profile photos.
 * public.list_orphaned_media() decides; it never lists a file that any publication, listing,
 * status (live or saved to the profile), message, profile or report evidence still points to,
 * nor anything younger than 48 h (a draft being retried). Run daily with the service-role key.
 * Body (optional): { "dryRun": true } lists without deleting.
 */
import { json } from '../_shared/http.ts';
import { admin, storage } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) return json({ error: 'unauthorized' }, 401);

  const dryRun = req.method === 'POST' && (await req.json().catch(() => ({})))?.dryRun === true;
  let rows: { bucket_id: string; name: string }[];
  try {
    rows = (await admin().rpc('list_orphaned_media', { p_limit: 500 })) ?? [];
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
  if (dryRun) return json({ ok: true, dryRun: true, files: rows.length, sample: rows.slice(0, 20) });

  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket_id, [...(byBucket.get(r.bucket_id) ?? []), r.name]);
  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const batch = names.slice(i, i + 100);
      if (await storage.remove(bucket, batch)) removed += batch.length;
    }
  }
  return json({ ok: true, files: rows.length, removed });
});
