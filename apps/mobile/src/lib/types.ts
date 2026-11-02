import type { Tables } from '@jefeli/shared';

export type ProfileRow = Tables<'profiles'>;

export type ProfileLite = Pick<
  ProfileRow,
  'id' | 'handle' | 'display_name' | 'avatar_path' | 'verification_level' | 'is_demo' | 'city'
>;

export type MediaRow = {
  id: string;
  kind: 'image' | 'video' | string;
  storage_path: string;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  position: number;
  bucket?: string;
};

export type ProductCard = Tables<'products'> & {
  seller: (ProfileLite & { rating_sum?: number; rating_count?: number; products_count?: number }) | null;
  media: MediaRow[];
};

export type TaggedProduct = Pick<Tables<'products'>, 'id' | 'title' | 'price_xof' | 'status' | 'listing_mode' | 'condition'> & {
  media: Pick<MediaRow, 'storage_path' | 'kind' | 'poster_path' | 'position'>[];
};

export type VoteValue = -1 | 0 | 1;

/** A genuine recent comment shown under a feed card (from get_comment_previews, RLS-filtered). */
export type CommentPreview = {
  post_id: string;
  comment_id: string;
  body: string;
  created_at: string;
  by_post_author: boolean;
  author: ProfileLite;
};

export type PostCardData = Tables<'posts'> & {
  author: ProfileLite | null;
  media: MediaRow[];
  tagged: { product: TaggedProduct | null }[];
  reason?: string;
  /** The viewer's own vote; downvotes are only ever visible to the member who cast them. */
  my_vote?: VoteValue;
  saved?: boolean;
  comments_preview?: CommentPreview[];
};

export type CommentRow = Tables<'comments'> & { author: ProfileLite | null };

export type StoryRow = Tables<'stories'>;

export type ConversationSummary = {
  conversation_id: string;
  other_user_id: string;
  last_message_at: string;
  last_message_preview: string;
  last_message_sender_id: string | null;
  unread_count: number;
  muted: boolean;
  other_last_read_at: string;
  other: ProfileLite | null;
};

export type MessageRow = Tables<'messages'>;
export type OfferRow = Tables<'offers'>;
export type AgreementRow = Tables<'agreements'>;

export type ProductSnapshot = {
  id: string;
  title: string;
  price_xof: number | null;
  condition: string;
  listing_mode: string;
  category_slug: string;
  city: string | null;
  seller_id: string;
  image_path: string | null;
  poster_path: string | null;
} | null;
