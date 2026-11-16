/**
 * Studio rules (P2): what a creation can be published to, in one pure place so the screen, the
 * tests and the report say the same thing.
 *
 *   media      : up to 8 photos, or one video (≤ 3 min), optionally a voice (alone or narrating)
 *   « sell »   : the switch « Vendre ou troquer cet article » — needs a photo or a video
 *   Fil        : a publication (text, photos, video, voice)
 *   Statut 24h : one photo, one video or one voice; a status with a narration or several photos is
 *                shared from its publication, so it needs Fil too (the files are not sent twice)
 *   Reel       : a permanent public video
 *   Boutique   : the article, only when the switch is on (the storefront lists every article)
 */

export type StudioMode = 'photo' | 'video' | 'voice' | 'text';
export type Destination = 'feed' | 'status' | 'reel' | 'boutique';
export type TextStarter = 'seek' | 'who_has' | 'recommend';

export const MAX_PHOTOS = 8;
export const DESTINATIONS: Destination[] = ['feed', 'status', 'reel', 'boutique'];
export const DESTINATION_LABELS: Record<Destination, string> = { feed: 'Fil', status: 'Statut 24 h', reel: 'Reel', boutique: 'Boutique' };

/** Starters of the « Texte » card. `intent` is the publication intent they publish with. */
export const TEXT_STARTERS: { key: TextStarter; label: string; text: string; intent: 'seek' | 'opinion' }[] = [
  { key: 'seek', label: 'Je cherche…', text: 'Je cherche ', intent: 'seek' },
  { key: 'who_has', label: 'Qui a… ?', text: 'Qui a ', intent: 'seek' },
  { key: 'recommend', label: 'Recommandez-moi…', text: 'Recommandez-moi ', intent: 'opinion' },
];

export interface StudioInput {
  photos: number;
  hasVideo: boolean;
  hasVoice: boolean;
  hasText: boolean;
  /** The « Vendre ou troquer cet article » switch. */
  sell: boolean;
  /** The account has a Boutique (the switch is on by default for it). */
  hasBoutique?: boolean;
}

export interface DestinationState {
  key: Destination;
  /** Can be ticked at all with this content. */
  available: boolean;
  /** Short French reason when it is not available (shown under the checkbox). */
  reason: string | null;
  /** Ticked by default when the content arrives. */
  defaultOn: boolean;
}

export const hasVisual = (i: Pick<StudioInput, 'photos' | 'hasVideo'>) => i.photos > 0 || i.hasVideo;

/** The switch is offered only for a creation that shows an article: a photo or a video. */
export function canSell(i: Pick<StudioInput, 'photos' | 'hasVideo'>): boolean {
  return hasVisual(i);
}

/** Should the switch start on? Yes for an account with a Boutique, when there is something to sell. */
export function sellDefault(i: StudioInput): boolean {
  return !!i.hasBoutique && canSell(i);
}

export function destinationStates(i: StudioInput): DestinationState[] {
  const visual = hasVisual(i);
  const content = visual || i.hasVoice || i.hasText;
  const feed: DestinationState = { key: 'feed', available: content, reason: content ? null : 'Ajoutez du contenu.', defaultOn: true };
  const status: DestinationState = {
    key: 'status',
    available: visual || i.hasVoice,
    reason: visual || i.hasVoice ? null : 'Un statut a besoin d’une photo, d’une vidéo ou d’une voix.',
    defaultOn: false,
  };
  const reel: DestinationState = {
    key: 'reel',
    available: i.hasVideo,
    reason: i.hasVideo ? null : 'Un Reel est une vidéo.',
    defaultOn: i.hasVideo,
  };
  const boutique: DestinationState = {
    key: 'boutique',
    available: i.sell,
    reason: i.sell ? null : 'Activez « Vendre ou troquer cet article ».',
    defaultOn: i.sell,
  };
  return [feed, status, reel, boutique];
}

/** A status needs Fil when it carries a narration or several photos: it points to the publication. */
export function statusNeedsFeed(i: Pick<StudioInput, 'photos' | 'hasVideo' | 'hasVoice'>): boolean {
  return (hasVisual(i) && i.hasVoice) || i.photos > 1;
}

/** Drops what the content cannot do and adds what the rules force (Boutique with the switch). */
export function normalizeSelection(i: StudioInput, selected: Destination[]): Destination[] {
  const states = destinationStates(i);
  const out = new Set(selected.filter((d) => states.find((s) => s.key === d)?.available));
  if (i.sell) out.add('boutique');
  else out.delete('boutique');
  if (out.has('status') && statusNeedsFeed(i) && !out.has('feed')) out.delete('status');
  return DESTINATIONS.filter((d) => out.has(d));
}

/** The destinations a fresh creation starts with. */
export function defaultSelection(i: StudioInput): Destination[] {
  return normalizeSelection(
    i,
    destinationStates(i).filter((s) => s.available && s.defaultOn).map((s) => s.key),
  );
}

export type StudioError = 'no_content' | 'no_destination' | 'text_only_item' | 'item_title' | 'item_price' | 'item_category' | 'text_needed';

/** What blocks publishing (null = ready). Keys are mapped to French by the screen. */
export function studioBlocker(
  i: StudioInput,
  selected: Destination[],
  item: { title: string; mode: 'sale' | 'trade' | 'give' | 'sale_or_trade'; price: number | null; priceMode?: 'fixed' | 'negotiable' | 'on_request'; category: string } | null,
): StudioError | null {
  if (!(hasVisual(i) || i.hasVoice || i.hasText)) return 'no_content';
  if (i.sell && !canSell(i)) return 'text_only_item'; // a text post is never a priced item
  const sel = normalizeSelection(i, selected);
  if (sel.length === 0) return 'no_destination';
  if (i.sell) {
    if (!item || item.title.trim().length < 3) return 'item_title';
    if (!item.category) return 'item_category';
    if ((item.mode === 'sale' || item.mode === 'sale_or_trade') && (item.priceMode ?? 'fixed') === 'fixed' && !(item.price && item.price > 0)) return 'item_price';
  }
  return null;
}

/** The article's name is the first line of the caption, trimmed (the caption stays its description). */
export function itemTitleFromCaption(caption: string, max = 60): string {
  const first = caption.trim().split(/\n/)[0] ?? '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/** The publication intent: a request card publishes as « Je cherche » / opinion, never as an item. */
export function textIntent(starter: TextStarter | null): 'seek' | 'opinion' | 'share' {
  return TEXT_STARTERS.find((s) => s.key === starter)?.intent ?? 'share';
}
