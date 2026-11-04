/**
 * Live-video provider adapter: Stream Video (getstream.io).
 *
 * The API secret never leaves the server. Clients only ever receive a short-lived user
 * token scoped to their own user id. If STREAM_API_KEY / STREAM_API_SECRET are not set,
 * every call reports `provider_not_configured` and the app keeps "Live" disabled — it
 * never fakes a live session.
 *
 * NOTE: endpoint paths and payload shapes follow Stream Video's server REST API (v2) as
 * known at build time; getstream.io was not reachable from the build environment, so they
 * must be re-verified against the official docs when credentials are added
 * (see docs/RELEASE_STATUS.md, LIVE-01/02).
 */
import { signHS256 } from './jwt.ts';

const API_BASE = Deno.env.get('STREAM_API_BASE') ?? 'https://video.stream-io-api.com';
export const CALL_TYPE = 'livestream';

export function streamConfig(): { apiKey: string; secret: string } | null {
  const apiKey = Deno.env.get('STREAM_API_KEY') ?? '';
  const secret = Deno.env.get('STREAM_API_SECRET') ?? '';
  if (!apiKey || !secret) return null;
  return { apiKey, secret };
}

/** Short-lived token for one user (default 2 h). */
export async function userToken(userId: string, secret: string, ttlSeconds = 2 * 60 * 60): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await signHS256({ user_id: userId, iat: now - 5, exp: now + ttlSeconds }, secret);
}

async function serverToken(secret: string): Promise<string> {
  return await signHS256({ server: true }, secret);
}

async function call(path: string, init: { method: string; body?: unknown }): Promise<Record<string, unknown>> {
  const cfg = streamConfig();
  if (!cfg) throw new Error('provider_not_configured');
  const res = await fetch(`${API_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(cfg.apiKey)}`, {
    method: init.method,
    headers: {
      Authorization: await serverToken(cfg.secret),
      'stream-auth-type': 'jwt',
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error('stream_error', res.status, JSON.stringify(data).slice(0, 500));
    throw new Error(`provider_error_${res.status}`);
  }
  return data;
}

export async function upsertUser(user: { id: string; name: string; image?: string | null }) {
  await call('/api/v2/users', {
    method: 'POST',
    body: { users: { [user.id]: { id: user.id, name: user.name, image: user.image ?? undefined, role: 'user' } } },
  });
}

export async function createLivestream(callId: string, hostId: string, sessionId: string) {
  return await call(`/api/v2/video/call/${CALL_TYPE}/${callId}`, {
    method: 'POST',
    body: {
      data: {
        created_by_id: hostId,
        members: [{ user_id: hostId, role: 'host' }],
        custom: { jefeli_session_id: sessionId },
      },
    },
  });
}

export async function getCallState(callId: string): Promise<{ live: boolean; ended: boolean; viewers: number | null }> {
  const data = (await call(`/api/v2/video/call/${CALL_TYPE}/${callId}`, { method: 'GET' })) as {
    call?: {
      backstage?: boolean;
      ended_at?: string | null;
      session?: { live_started_at?: string | null; live_ended_at?: string | null; participants?: unknown[]; anonymous_participant_count?: number } | null;
    };
  };
  const c = data.call ?? {};
  const s = c.session ?? null;
  const ended = !!c.ended_at || !!s?.live_ended_at;
  const live = !ended && c.backstage === false && !!s?.live_started_at;
  const viewers = s ? Math.max(0, (s.participants?.length ?? 0) - 1) + (s.anonymous_participant_count ?? 0) : null;
  return { live, ended, viewers };
}

export async function endCall(callId: string) {
  await call(`/api/v2/video/call/${CALL_TYPE}/${callId}/mark_ended`, { method: 'POST', body: {} });
}
