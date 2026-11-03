import type { ItemCondition, ListingMode, PriceMode, ProductStatus } from '@jefeli/shared';

import { supabase, unwrap } from '../supabase';
import type { ProductCard } from '../types';
import type { UploadedMedia } from '../upload';
import { PROFILE_LITE } from './profiles';

export const PRODUCT_SELECT = `*,
  seller:profiles!products_seller_id_fkey(${PROFILE_LITE}, rating_sum, rating_count, products_count),
  media:product_media(id, kind, storage_path, poster_path, width, height, duration_ms, position)`;

export const PRODUCT_PAGE = 20;

function sortMedia(p: ProductCard): ProductCard {
  return { ...p, media: [...(p.media ?? [])].sort((a, b) => a.position - b.position) };
}

export type BrowseMode = 'recent' | 'occasions' | 'troc' | 'nearby';

export async function browseProducts(args: {
  mode?: BrowseMode;
  query?: string | null;
  category?: string | null;
  city?: string | null;
  condition?: string | null;
  offset?: number;
  limit?: number;
}): Promise<ProductCard[]> {
  const rows = unwrap(
    await supabase
      .rpc('browse_products', {
        p_mode: args.mode ?? 'recent',
        p_query: args.query || undefined,
        p_category: args.category || undefined,
        p_city: args.city || undefined,
        p_condition: args.condition || undefined,
        p_limit: args.limit ?? PRODUCT_PAGE,
        p_offset: args.offset ?? 0,
      })
      .select(PRODUCT_SELECT),
  ) as unknown as ProductCard[];
  return rows.map(sortMedia);
}

export async function fetchProduct(id: string): Promise<ProductCard | null> {
  const row = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle()) as unknown as ProductCard | null;
  return row ? sortMedia(row) : null;
}

export async function fetchSellerProducts(sellerId: string, opts: { includeSold?: boolean; onlyActive?: boolean } = {}): Promise<ProductCard[]> {
  // Pinned listings first, then the newest.
  let q = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('seller_id', sellerId)
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(60);
  if (opts.onlyActive) q = q.eq('status', 'active');
  else if (!opts.includeSold) q = q.in('status', ['active', 'reserved']);
  else q = q.neq('status', 'archived');
  return (unwrap(await q) as unknown as ProductCard[]).map(sortMedia);
}

export async function fetchSavedProducts(userId: string): Promise<ProductCard[]> {
  const rows = unwrap(
    await supabase
      .from('product_saves')
      .select(`created_at, product:products(${PRODUCT_SELECT})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
  ) as unknown as { product: ProductCard | null }[];
  return rows.map((r) => r.product).filter((p): p is ProductCard => !!p).map(sortMedia);
}

export async function isProductSaved(userId: string, productId: string): Promise<boolean> {
  const row = unwrap(await supabase.from('product_saves').select('product_id').eq('user_id', userId).eq('product_id', productId).maybeSingle());
  return !!row;
}

export async function setProductSaved(userId: string, productId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase.from('product_saves').insert({ user_id: userId, product_id: productId });
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    unwrap(await supabase.from('product_saves').delete().eq('user_id', userId).eq('product_id', productId));
  }
}

export interface ListingInput {
  title: string;
  description: string;
  price_xof: number | null;
  price_mode: PriceMode;
  category_slug: string;
  condition: ItemCondition;
  listing_mode: ListingMode;
  quantity: number;
  city: string;
  neighborhood: string;
  delivery_options: string[];
  delivery_notes: string;
}

export async function createListing(input: ListingInput, media: UploadedMedia[]): Promise<string> {
  return unwrap(
    await supabase.rpc('create_listing', {
      p_title: input.title,
      p_description: input.description,
      p_price_xof: (input.price_mode === 'on_request' ? null : input.price_xof) as number,
      p_price_mode: input.price_mode,
      p_category_slug: input.category_slug,
      p_condition: input.condition,
      p_listing_mode: input.listing_mode,
      p_quantity: input.quantity,
      p_city: input.city,
      p_neighborhood: input.neighborhood,
      p_delivery_options: input.delivery_options,
      p_delivery_notes: input.delivery_notes,
      p_media: media as unknown as never,
    }),
  ) as string;
}

export async function updateListing(id: string, patch: Partial<ListingInput> & { status?: ProductStatus }) {
  unwrap(await supabase.from('products').update(patch).eq('id', id));
}

export async function setListingStatus(id: string, status: ProductStatus) {
  unwrap(await supabase.from('products').update({ status }).eq('id', id));
}

export async function deleteListing(id: string) {
  unwrap(await supabase.from('products').delete().eq('id', id));
}

export async function fetchCategories() {
  return unwrap(await supabase.from('categories').select('*').eq('is_active', true).order('position'));
}

export async function fetchActiveCities(): Promise<{ city: string; listings: number }[]> {
  return unwrap(await supabase.rpc('active_cities', { p_limit: 12 })) as { city: string; listings: number }[];
}

export async function fetchBoutique(ownerId: string) {
  return unwrap(await supabase.from('boutiques').select('*').eq('owner_id', ownerId).maybeSingle());
}

export async function updateBoutique(ownerId: string, patch: { description?: string; pickup_notes?: string; delivery_notes?: string; payment_notes?: string }) {
  unwrap(await supabase.from('boutiques').update(patch).eq('owner_id', ownerId));
}
