import { publicStorageUrl } from '@jefeli/shared';
import { env } from './env';

export function avatarUrl(path: string | null | undefined): string | null {
  return publicStorageUrl(env.supabaseUrl, 'avatars', path);
}

export function publicMediaUrl(path: string | null | undefined): string | null {
  return publicStorageUrl(env.supabaseUrl, 'public-media', path);
}

/** Avatars and covers may live in the avatars bucket (default) — mobile uploads them there. */
export function coverUrl(path: string | null | undefined): string | null {
  return publicStorageUrl(env.supabaseUrl, 'avatars', path);
}

export type MediaItem = {
  kind: string;
  storage_path: string;
  poster_path: string | null;
  position: number;
};

export function sortMedia<T extends { position: number }>(media: T[] | null | undefined): T[] {
  return [...(media ?? [])].sort((a, b) => a.position - b.position);
}

/** Best still image for a media list (image itself, or a video's poster). */
export function firstStill(media: MediaItem[] | null | undefined): string | null {
  for (const m of sortMedia(media)) {
    if (m.kind === 'image') return publicMediaUrl(m.storage_path);
    if (m.kind === 'video' && m.poster_path) return publicMediaUrl(m.poster_path);
  }
  return null;
}
