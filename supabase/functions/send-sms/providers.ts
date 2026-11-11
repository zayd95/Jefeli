/**
 * SMS providers for the `send-sms` hook. Each returns what the provider actually answered:
 * a message reference when it accepted the SMS, or an error. Nothing here ever reports a
 * success that the provider did not give. Provider choice: `SMS_PROVIDER` (docs/PHONE_AUTH.md).
 */
export type SendResult = { ok: true; ref: string | null } | { ok: false; error: string };

export interface SmsProvider {
  name: string;
  send(toE164: string, text: string, hookId: string): Promise<SendResult>;
}

const env = (key: string) => (Deno.env.get(key) ?? '').trim();

async function timed(input: string, init: RequestInit, ms: number): Promise<Response> {
  return await fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}

function short(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 160);
}

/**
 * Orange SMS API (Orange Developer, "SMS Sénégal"): OAuth client credentials, then the
 * `smsmessaging/v1/outbound/{sender}/requests` endpoint. The token is cached for its lifetime
 * because Supabase gives the whole hook about 5 seconds.
 */
let orangeToken: { value: string; until: number } | null = null;

export function orange(): SmsProvider | null {
  const id = env('ORANGE_CLIENT_ID');
  const secret = env('ORANGE_CLIENT_SECRET');
  const sender = env('ORANGE_SENDER_ADDRESS'); // e.g. tel:+2210000, as shown in the Orange console
  const senderName = env('ORANGE_SENDER_NAME'); // optional, only once approved by Orange
  if (!id || !secret || !sender) return null;
  const base = env('ORANGE_API_BASE') || 'https://api.orange.com';

  async function token(): Promise<string> {
    if (orangeToken && orangeToken.until > Date.now()) return orangeToken.value;
    const res = await timed(`${base}/oauth/v3/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    }, 1500);
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: string | number };
    if (!res.ok || !data.access_token) throw new Error(`orange_token_${res.status}`);
    const ttl = Math.max(60, Number(data.expires_in ?? 3600) - 60) * 1000;
    orangeToken = { value: data.access_token, until: Date.now() + ttl };
    return data.access_token;
  }

  return {
    name: 'orange',
    async send(toE164, text) {
      try {
        const bearer = await token();
        const res = await timed(`${base}/smsmessaging/v1/outbound/${encodeURIComponent(sender)}/requests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            outboundSMSMessageRequest: {
              address: `tel:${toE164}`,
              senderAddress: sender,
              ...(senderName ? { senderName } : {}),
              outboundSMSTextMessage: { message: text },
            },
          }),
        }, 3000);
        const raw = await res.text();
        if (res.status === 401) orangeToken = null;
        if (!res.ok) return { ok: false, error: `orange_${res.status}:${short(raw)}` };
        const url = (JSON.parse(raw || '{}') as { outboundSMSMessageRequest?: { resourceURL?: string } })
          .outboundSMSMessageRequest?.resourceURL ?? null;
        return { ok: true, ref: url ? url.split('/').pop() ?? url : null };
      } catch (e) {
        return { ok: false, error: `orange_error:${short(String(e))}` };
      }
    },
  };
}

/** Twilio Programmable Messaging (paid fallback). From = registered alphanumeric sender or a Messaging Service. */
export function twilio(): SmsProvider | null {
  const sid = env('TWILIO_ACCOUNT_SID');
  const tokenValue = env('TWILIO_AUTH_TOKEN');
  const from = env('TWILIO_FROM'); // alphanumeric sender ID, or MGxxxx messaging service SID
  if (!sid || !tokenValue || !from) return null;
  return {
    name: 'twilio',
    async send(toE164, text) {
      try {
        const form = new URLSearchParams({ To: toE164, Body: text });
        form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
        const res = await timed(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`${sid}:${tokenValue}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        }, 3500);
        const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
        if (!res.ok) return { ok: false, error: `twilio_${res.status}:${data.code ?? ''}:${short(data.message ?? '')}` };
        return { ok: true, ref: data.sid ?? null };
      } catch (e) {
        return { ok: false, error: `twilio_error:${short(String(e))}` };
      }
    },
  };
}

/**
 * Local test sink: posts the SMS to the test runner (like the local mail catcher for e-mails),
 * so automated tests read the real code generated by the auth server. Refuses to run anywhere
 * but a local Supabase stack.
 */
export function sink(): SmsProvider | null {
  const url = env('SMS_SINK_URL');
  const supabaseHost = (() => {
    try {
      return new URL(env('SUPABASE_URL')).hostname;
    } catch {
      return '';
    }
  })();
  const local = ['kong', 'localhost', '127.0.0.1', 'host.docker.internal'].includes(supabaseHost);
  if (!url || !local) return null;
  return {
    name: 'sink',
    async send(toE164, text, hookId) {
      try {
        const res = await timed(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: toE164, text, hook_id: hookId }),
        }, 2000);
        if (!res.ok) return { ok: false, error: `sink_${res.status}` };
        return { ok: true, ref: `sink-${hookId}` };
      } catch (e) {
        return { ok: false, error: `sink_error:${short(String(e))}` };
      }
    },
  };
}

export function configuredProvider(): SmsProvider | null {
  switch (env('SMS_PROVIDER')) {
    case 'orange':
      return orange();
    case 'twilio':
      return twilio();
    case 'sink':
      return sink();
    default:
      return null;
  }
}
