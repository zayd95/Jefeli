// Minimal HS256 JWT signing + HMAC helpers using WebCrypto (no third-party dependency).
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function signHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}

export async function hmacHex(message: string, secret: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
