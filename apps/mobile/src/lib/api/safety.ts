import { env } from '../env';
import { supabase, unwrap } from '../supabase';

export type ReportTarget =
  | 'profile'
  | 'post'
  | 'comment'
  | 'product'
  | 'story'
  | 'message'
  | 'live_session'
  | 'live_comment'
  | 'agreement'
  | 'review';

export async function reportContent(targetType: ReportTarget, targetId: string, reason: string, details: string): Promise<string> {
  return unwrap(
    await supabase.rpc('report_content', { p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_details: details }),
  ) as string;
}

export async function myReports(userId: string) {
  return unwrap(
    await supabase.from('reports').select('id, target_type, reason, status, created_at').eq('reporter_id', userId).order('created_at', { ascending: false }).limit(50),
  );
}

export async function myModerationActions(userId: string) {
  return unwrap(
    await supabase
      .from('moderation_actions')
      .select('id, action, target_type, target_id, reason, created_at')
      .eq('target_owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

export async function myAppeals(userId: string) {
  return unwrap(await supabase.from('appeals').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
}

export async function submitAppeal(actionId: string, body: string) {
  return unwrap(await supabase.rpc('submit_appeal', { p_moderation_action_id: actionId, p_body: body }));
}

export async function requestVerification(userId: string, input: { business_name: string; business_type: string; details: string }) {
  unwrap(await supabase.from('verification_requests').insert({ user_id: userId, ...input }));
}

export async function myVerificationRequests(userId: string) {
  return unwrap(await supabase.from('verification_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
}

export async function exportMyData(): Promise<unknown> {
  return unwrap(await supabase.rpc('export_my_data'));
}

/** Permanent deletion through the trusted `delete-account` Edge Function. */
export async function deleteMyAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');
  const res = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: env.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `http_${res.status}`);
  }
}

export async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = unwrap(await supabase.from('feature_flags').select('key, enabled'));
  return Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
}
