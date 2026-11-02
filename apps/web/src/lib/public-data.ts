import { cache } from 'react';
import { HANDLE_PATTERN } from '@jefeli/shared';
import type { ItemCondition, ListingMode, ProductStatus } from '@jefeli/shared';
import { publicClient } from './supabase/public';

/**
 * Read-only queries for the public share pages. Every query runs as the anonymous role, so
 * Row Level Security decides what exists: private accounts, hidden/removed content, archived
 * listings, suspended members and non-public posts simply come back empty.
 *
 * Columns are listed explicitly — the pages only render what they need.
 */

/** Route words that can never be a member handle (mirrors public.reserved_handles). */
export const RESERVED_ROUTE_WORDS = new Set([
  'admin', 'administrateur', 'jefeli', 'jefeli_officiel', 'support', 'aide', 'moderation', 'moderateur',
  'staff', 'equipe', 'api', 'www', 'app', 'root', 'system', 'systeme', 'securite', 'security', 'help',
  'contact', 'p', 'u', 'post', 'live', 'explorer', 'messages', 'profil', 'settings', 'login', 'signup',
  'auth', 'legal', 'cgu', 'confidentialite', 'null', 'undefined', 'favicon.ico', 'robots.txt',
  'sitemap.xml', 'icon', 'apple-icon', 'opengraph-image', 'manifest.webmanifest', '_next',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isPlausibleHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle) && !RESERVED_ROUTE_WORDS.has(handle);
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type PublicProfile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  cover_path: string | null;
  city: string | null;
  neighborhood: string | null;
  is_private: boolean;
  is_merchant: boolean;
  verification_level: 'none' | 'merchant_verified';
  is_demo: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  products_count: number;
  rating_sum: number;
  rating_count: number;
  created_at: string;
};

export type ProfileSummary = Pick<
  PublicProfile,
  | 'id'
  | 'handle'
  | 'display_name'
  | 'avatar_path'
  | 'city'
  | 'neighborhood'
  | 'verification_level'
  | 'is_demo'
  | 'rating_sum'
  | 'rating_count'
  | 'products_count'
>;

export type MediaRow = {
  kind: string;
  storage_path: string;
  poster_path: string | null;
  position: number;
  width?: number | null;
  height?: number | null;
};

export type PostMediaRow = MediaRow & { bucket: string };

export type ProductCardRow = {
  id: string;
  title: string;
  price_xof: number | null;
  condition: ItemCondition;
  listing_mode: ListingMode;
  status: ProductStatus;
  city: string | null;
  neighborhood: string | null;
  created_at: string;
  product_media: MediaRow[];
};

export type ProductDetail = ProductCardRow & {
  description: string;
  category_slug: string;
  quantity: number;
  delivery_options: string[];
  delivery_notes: string;
  updated_at: string;
  seller_id: string;
  seller: ProfileSummary | null;
  category: { name: string } | null;
};

export type BoutiqueRow = {
  description: string;
  pickup_notes: string;
  delivery_notes: string;
  payment_notes: string;
};

export type PostRow = {
  id: string;
  body: string;
  kind: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  edited_at: string | null;
  post_media: PostMediaRow[];
};

export type PostDetail = PostRow & {
  author_id: string;
  author: ProfileSummary | null;
  post_products: { products: ProductCardRow | null }[];
};

export type ReviewRow = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  reviewer: Pick<PublicProfile, 'handle' | 'display_name' | 'avatar_path'> | null;
};

export type LiveDetail = {
  id: string;
  title: string;
  status: 'created' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  host_id: string;
  host: ProfileSummary | null;
};

const PROFILE_COLUMNS =
  'id, handle, display_name, bio, avatar_path, cover_path, city, neighborhood, is_private, is_merchant, verification_level, is_demo, followers_count, following_count, posts_count, products_count, rating_sum, rating_count, created_at';

const SUMMARY_COLUMNS =
  'id, handle, display_name, avatar_path, city, neighborhood, verification_level, is_demo, rating_sum, rating_count, products_count';

const MEDIA_COLUMNS = 'kind, storage_path, poster_path, position, width, height';

const CARD_COLUMNS = `id, title, price_xof, condition, listing_mode, status, city, neighborhood, created_at, product_media(${MEDIA_COLUMNS})`;

const STATUS_ORDER: Record<ProductStatus, number> = { active: 0, reserved: 1, sold: 2, archived: 3 };

// ---------------------------------------------------------------------------
// Queries (wrapped in React cache: generateMetadata and the page share one round-trip)
// ---------------------------------------------------------------------------

export const getProfileByHandle = cache(async (handle: string): Promise<PublicProfile | null> => {
  if (!isPlausibleHandle(handle)) return null;
  const { data, error } = await publicClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('handle', handle)
    .maybeSingle()
    .overrideTypes<PublicProfile, { merge: false }>();
  if (error) throw new Error(`profil: ${error.message}`);
  return data;
});

export const getBoutique = cache(async (ownerId: string): Promise<BoutiqueRow | null> => {
  const { data, error } = await publicClient()
    .from('boutiques')
    .select('description, pickup_notes, delivery_notes, payment_notes')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(`boutique: ${error.message}`);
  return data;
});

export const getSellerProducts = cache(
  async (sellerId: string, limit = 24, excludeId?: string): Promise<ProductCardRow[]> => {
    let query = publicClient()
      .from('products')
      .select(CARD_COLUMNS)
      .eq('seller_id', sellerId)
      .in('status', ['active', 'reserved', 'sold'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.overrideTypes<ProductCardRow[], { merge: false }>();
    if (error) throw new Error(`articles: ${error.message}`);
    // Available first, then reserved, then sold — newest first inside each group.
    return [...(data ?? [])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  },
);

export const getRecentPosts = cache(async (authorId: string, limit = 6): Promise<PostRow[]> => {
  const { data, error } = await publicClient()
    .from('posts')
    .select(`id, body, kind, like_count, comment_count, created_at, edited_at, post_media(bucket, ${MEDIA_COLUMNS})`)
    .eq('author_id', authorId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<PostRow[], { merge: false }>();
  if (error) throw new Error(`publications: ${error.message}`);
  return data ?? [];
});

export const getRecentReviews = cache(async (revieweeId: string, limit = 3): Promise<ReviewRow[]> => {
  const { data, error } = await publicClient()
    .from('reviews')
    .select('id, rating, body, created_at, reviewer:profiles!reviews_reviewer_id_fkey(handle, display_name, avatar_path)')
    .eq('reviewee_id', revieweeId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<ReviewRow[], { merge: false }>();
  if (error) throw new Error(`avis: ${error.message}`);
  return data ?? [];
});

export const getProduct = cache(async (id: string): Promise<ProductDetail | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await publicClient()
    .from('products')
    .select(
      `id, title, description, price_xof, category_slug, condition, listing_mode, quantity, status, city, neighborhood, delivery_options, delivery_notes, created_at, updated_at, seller_id,
       product_media(${MEDIA_COLUMNS}),
       seller:profiles!products_seller_id_fkey(${SUMMARY_COLUMNS}),
       category:categories(name)`,
    )
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<ProductDetail, { merge: false }>();
  if (error) throw new Error(`article: ${error.message}`);
  return data;
});

export const getPost = cache(async (id: string): Promise<PostDetail | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await publicClient()
    .from('posts')
    .select(
      `id, body, kind, like_count, comment_count, created_at, edited_at, author_id,
       post_media(bucket, ${MEDIA_COLUMNS}),
       author:profiles!posts_author_id_fkey(${SUMMARY_COLUMNS}),
       post_products(products(${CARD_COLUMNS}))`,
    )
    .eq('id', id)
    .eq('visibility', 'public')
    .maybeSingle()
    .overrideTypes<PostDetail, { merge: false }>();
  if (error) throw new Error(`publication: ${error.message}`);
  return data;
});

export const getLive = cache(async (id: string): Promise<LiveDetail | null> => {
  if (!isUuid(id)) return null;
  const { data, error } = await publicClient()
    .from('live_sessions')
    .select(
      `id, title, status, started_at, ended_at, created_at, host_id,
       host:profiles!live_sessions_host_id_fkey(${SUMMARY_COLUMNS})`,
    )
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<LiveDetail, { merge: false }>();
  if (error) throw new Error(`live: ${error.message}`);
  return data;
});

/** Product currently pinned during a live (if any, and if still publicly visible). */
export const getLivePinnedProduct = cache(async (liveId: string): Promise<ProductCardRow | null> => {
  const { data, error } = await publicClient()
    .from('live_pins')
    .select(`pinned_at, products(${CARD_COLUMNS})`)
    .eq('live_session_id', liveId)
    .is('unpinned_at', null)
    .order('pinned_at', { ascending: false })
    .limit(1)
    .overrideTypes<{ pinned_at: string; products: ProductCardRow | null }[], { merge: false }>();
  if (error) return null;
  return data?.[0]?.products ?? null;
});

/** "4,8" — one decimal, French separator. */
export function ratingAverage(sum: number, count: number): string | null {
  if (!count) return null;
  return (Math.round((sum / count) * 10) / 10).toFixed(1).replace('.', ',');
}
