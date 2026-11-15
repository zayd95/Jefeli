/**
 * Media URL resolution.
 *  - avatars / public-media: stable public URLs (CDN-cacheable)
 *  - private-media: short-lived signed URLs, issued only if RLS authorizes the viewer
 */
import { publicStorageUrl } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';

import { env } from './env';
import { supabase } from './supabase';

export type Bucket = 'avatars' | 'public-media' | 'private-media';

export function publicUrl(bucket: 'avatars' | 'public-media', path: string | null | undefined): string | null {
  return publicStorageUrl(env.supabaseUrl, bucket, path);
}

export function avatarUrl(path: string | null | undefined): string | null {
  return publicUrl('avatars', path);
}

const SIGNED_TTL = 60 * 60; // 1h

export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('private-media').createSignedUrl(path, SIGNED_TTL);
  if (error) return null;
  return data.signedUrl;
}

/** Resolve any (bucket, path) to a displayable URL. Private paths are signed and cached. */
export function useMediaUrl(bucket: Bucket, path: string | null | undefined): string | null {
  const isPrivate = bucket === 'private-media';
  const q = useQuery({
    queryKey: ['signed-url', path],
    queryFn: () => signedUrl(path as string),
    enabled: isPrivate && !!path,
    staleTime: (SIGNED_TTL - 120) * 1000,
    gcTime: SIGNED_TTL * 1000,
  });
  if (!path) return null;
  if (!isPrivate) return publicUrl(bucket, path);
  return q.data ?? null;
}
