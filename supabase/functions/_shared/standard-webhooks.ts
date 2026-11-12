/**
 * Standard Webhooks verification (https://www.standardwebhooks.com), as used by Supabase Auth
 * hooks: headers `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256>`
 * over `${id}.${timestamp}.${body}`, keyed with the base64 part of `v1,whsec_<base64>`.
 * Several secrets may be configured separated by `|` (rotation). WebCrypto only.
 */
const enc = new TextEncoder();
const TOLERANCE_SECONDS = 5 * 60;

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseSecrets(raw: string): Uint8Array[] {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^v1,/, '').replace(/^whsec_/, ''))
    .map(decodeBase64)
    .filter((k) => k.length >= 16);
}

export async function sign(key: Uint8Array, id: string, timestamp: string, body: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${id}.${timestamp}.${body}`)));
  return encodeBase64(sig);
}

export type VerifyResult = { ok: true; id: string } | { ok: false; reason: 'missing_headers' | 'stale' | 'bad_signature' | 'no_secret' };

export async function verify(headers: Headers, body: string, rawSecrets: string, now = Date.now()): Promise<VerifyResult> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signature = headers.get('webhook-signature');
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing_headers' };
  const keys = parseSecrets(rawSecrets);
  if (!keys.length) return { ok: false, reason: 'no_secret' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  const offered = signature
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));
  for (const key of keys) {
    const expected = await sign(key, id, timestamp, body);
    if (offered.some((sig) => timingSafeEqual(sig, expected))) return { ok: true, id };
  }
  return { ok: false, reason: 'bad_signature' };
}
