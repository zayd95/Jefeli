/**
 * Public share URLs (resolve on the web app without install) and app deep links.
 * Base URL comes from configuration; the production domain is not cleared yet.
 */
export const APP_SCHEME = 'jefeli';

export function trimBase(base: string): string {
  return base.replace(/\/+$/, '');
}

export const shareUrls = {
  profile: (base: string, handle: string) => `${trimBase(base)}/${encodeURIComponent(handle)}`,
  product: (base: string, id: string) => `${trimBase(base)}/p/${id}`,
  post: (base: string, id: string) => `${trimBase(base)}/post/${id}`,
  live: (base: string, id: string) => `${trimBase(base)}/live/${id}`,
};

export const deepLinks = {
  profile: (handle: string) => `${APP_SCHEME}://u/${encodeURIComponent(handle)}`,
  product: (id: string) => `${APP_SCHEME}://p/${id}`,
  post: (id: string) => `${APP_SCHEME}://post/${id}`,
  live: (id: string) => `${APP_SCHEME}://live/${id}`,
};

/** Public storage URL for public buckets (avatars, public-media). */
export function publicStorageUrl(supabaseUrl: string, bucket: 'avatars' | 'public-media', path: string | null | undefined): string | null {
  if (!path) return null;
  return `${trimBase(supabaseUrl)}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
