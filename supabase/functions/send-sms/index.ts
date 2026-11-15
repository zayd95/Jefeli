/**
 * Supabase Auth "Send SMS" hook — the only way a Jëfëli sign-in code reaches a phone.
 *
 * 1. Verifies the auth server's signature (SEND_SMS_HOOK_SECRET, Standard Webhooks).
 * 2. Asks the database guard: `phone_auth` switched on, destination in an allowed range
 *    (Senegal mobiles to start), caps per number / IP / day (`public.sms_hook_begin`).
 * 3. Sends with the configured provider (SMS_PROVIDER) and records the provider's answer.
 *
 * No provider configured → the code is NOT sent and the member gets an error: nothing is
 * simulated. No OTP and no full phone number are logged (keyed hashes only, SMS_LOG_KEY).
 */
import { hmacHex } from '../_shared/jwt.ts';
import { admin } from '../_shared/supabase.ts';
import { verify } from '../_shared/standard-webhooks.ts';
import { configuredProvider } from './providers.ts';

interface HookPayload {
  metadata?: { ip_address?: string };
  user?: { id?: string; phone?: string };
  sms?: { otp?: string; phone?: string };
}

// The auth server relays `message` to the app, which maps these keys to French copy
// (packages/shared/src/errors.ts). HTTP 200 + error object: Supabase does not retry it.
function refuse(httpCode: number, key: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message: key } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const REASONS: Record<string, [number, string]> = {
  disabled: [403, 'sms_disabled'],
  destination: [400, 'sms_destination_not_allowed'],
  daily_budget: [429, 'sms_daily_budget'],
  number_hour: [429, 'sms_limit_number'],
  number_day: [429, 'sms_limit_number'],
  ip_hour: [429, 'sms_limit_ip'],
};

function message(otp: string): string {
  // One UCS-2 segment (≤ 70 characters): « ë » makes the message Unicode.
  const text = `Jëfëli : votre code est ${otp}. Ne le partagez avec personne.`;
  // Optional Web OTP line for Chrome on Android (costs a second segment): @domain #code
  const domain = (Deno.env.get('SMS_WEB_OTP_DOMAIN') ?? '').trim();
  return domain ? `${text}\n\n@${domain} #${otp}` : text;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const body = await req.text();

  const verified = await verify(req.headers, body, Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '');
  if (!verified.ok) {
    console.warn('send_sms_rejected_signature', verified.reason);
    return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return refuse(400, 'sms_invalid_request');
  }
  const otp = payload.sms?.otp ?? '';
  const digits = (payload.sms?.phone ?? payload.user?.phone ?? '').replace(/\D/g, '');
  if (!/^\d{4,10}$/.test(otp) || !/^[1-9]\d{7,14}$/.test(digits)) return refuse(400, 'sms_invalid_request');

  const logKey = Deno.env.get('SMS_LOG_KEY') ?? '';
  const provider = configuredProvider();
  if (!logKey || !provider) {
    console.error('send_sms_not_configured', { provider: !!provider, log_key: !!logKey });
    return refuse(503, 'sms_provider_unavailable');
  }

  const db = admin();
  const ip = payload.metadata?.ip_address?.trim() || null;
  let guard: { allowed: boolean; reason: string | null; event_id: number };
  try {
    guard = await db.rpc('sms_hook_begin', {
      p_hook_id: verified.id,
      p_phone_key: await hmacHex(`phone:${digits}`, logKey),
      p_phone_prefix: digits.slice(0, 5),
      p_ip_key: ip ? await hmacHex(`ip:${ip}`, logKey) : null,
      p_user_id: payload.user?.id ?? null,
    });
  } catch (e) {
    console.error('send_sms_guard_failed', String(e));
    return refuse(503, 'sms_provider_unavailable');
  }

  if (!guard.allowed) {
    // A retried call for an SMS already sent: answer success, never send it twice.
    if (guard.reason === 'duplicate') return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const [code, key] = REASONS[guard.reason ?? ''] ?? [429, 'sms_limit_number'];
    return refuse(code, key);
  }

  const result = await provider.send(`+${digits}`, message(otp), verified.id);
  try {
    await db.rpc('sms_hook_finish', {
      p_event_id: guard.event_id,
      p_outcome: result.ok ? 'sent' : 'failed',
      p_provider: provider.name,
      p_provider_ref: result.ok ? result.ref : null,
      p_reason: result.ok ? null : result.error,
    });
  } catch (e) {
    console.error('send_sms_record_failed', String(e));
  }
  if (!result.ok) {
    console.error('send_sms_provider_failed', provider.name, result.error);
    return refuse(502, 'sms_send_failed');
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
