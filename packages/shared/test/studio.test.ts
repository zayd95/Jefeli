import { describe, expect, it } from 'vitest';

import { canSell, defaultSelection, destinationStates, itemTitleFromCaption, normalizeSelection, sellDefault, statusNeedsFeed, studioBlocker, textIntent, type StudioInput } from '../src/studio';

const base: StudioInput = { photos: 0, hasVideo: false, hasVoice: false, hasText: false, sell: false };
const item = { title: 'Boubou brodé', mode: 'sale' as const, price: 25000, category: 'mode-femme' };

describe('Studio destinations', () => {
  it('a text card goes to Fil only: no status, no Reel, no Boutique, never a priced item', () => {
    const t = { ...base, hasText: true };
    const states = destinationStates(t);
    expect(states.filter((s) => s.available).map((s) => s.key)).toEqual(['feed']);
    expect(canSell(t)).toBe(false);
    expect(studioBlocker({ ...t, sell: true }, ['feed'], item)).toBe('text_only_item');
    expect(studioBlocker(t, ['feed'], null)).toBeNull();
  });

  it('Reel only for a video', () => {
    expect(destinationStates({ ...base, photos: 3 }).find((s) => s.key === 'reel')?.available).toBe(false);
    expect(destinationStates({ ...base, hasVideo: true }).find((s) => s.key === 'reel')?.available).toBe(true);
    expect(defaultSelection({ ...base, hasVideo: true })).toEqual(['feed', 'reel']);
  });

  it('Boutique only when the switch is on, and forced then', () => {
    const photo = { ...base, photos: 2 };
    expect(destinationStates(photo).find((s) => s.key === 'boutique')?.available).toBe(false);
    expect(normalizeSelection({ ...photo, sell: true }, ['feed'])).toEqual(['feed', 'boutique']);
    expect(normalizeSelection({ ...photo, sell: false }, ['feed', 'boutique'])).toEqual(['feed']);
    expect(defaultSelection({ ...photo, sell: true })).toEqual(['feed', 'boutique']);
  });

  it('the switch starts on for a Boutique account with a photo or a video, never for text or voice alone', () => {
    expect(sellDefault({ ...base, photos: 1, hasBoutique: true })).toBe(true);
    expect(sellDefault({ ...base, photos: 1, hasBoutique: false })).toBe(false);
    expect(sellDefault({ ...base, hasText: true, hasBoutique: true })).toBe(false);
    expect(sellDefault({ ...base, hasVoice: true, hasBoutique: true })).toBe(false);
  });

  it('a status with a narration or several photos needs Fil (it is shared from the publication)', () => {
    expect(statusNeedsFeed({ photos: 1, hasVideo: false, hasVoice: false })).toBe(false);
    expect(statusNeedsFeed({ photos: 1, hasVideo: false, hasVoice: true })).toBe(true);
    expect(statusNeedsFeed({ photos: 4, hasVideo: false, hasVoice: false })).toBe(true);
    expect(normalizeSelection({ ...base, photos: 4 }, ['status'])).toEqual([]);
    expect(normalizeSelection({ ...base, photos: 4 }, ['feed', 'status'])).toEqual(['feed', 'status']);
    expect(normalizeSelection({ ...base, photos: 1 }, ['status'])).toEqual(['status']);
  });

  it('a voice alone can be a status or a publication', () => {
    const v = { ...base, hasVoice: true };
    expect(destinationStates(v).filter((s) => s.available).map((s) => s.key)).toEqual(['feed', 'status']);
  });

  it('blockers: nothing to publish, no destination, an article without a name, a category or a price', () => {
    expect(studioBlocker(base, [], null)).toBe('no_content');
    expect(studioBlocker({ ...base, photos: 1 }, [], null)).toBe('no_destination');
    const sell = { ...base, photos: 1, sell: true };
    expect(studioBlocker(sell, ['feed'], { ...item, title: 'a' })).toBe('item_title');
    expect(studioBlocker(sell, ['feed'], { ...item, category: '' })).toBe('item_category');
    expect(studioBlocker(sell, ['feed'], { ...item, price: null })).toBe('item_price');
    expect(studioBlocker(sell, ['feed'], { ...item, mode: 'give', price: null })).toBeNull();
    expect(studioBlocker(sell, ['feed'], { ...item, mode: 'trade', price: null })).toBeNull();
    expect(studioBlocker(sell, ['feed'], { ...item, priceMode: 'negotiable', price: null })).toBeNull();
    expect(studioBlocker(sell, ['feed'], { ...item, mode: 'sale_or_trade', price: null })).toBe('item_price');
    expect(studioBlocker(sell, ['feed'], item)).toBeNull();
  });

  it('the article name is the first line of the caption', () => {
    expect(itemTitleFromCaption('  Boubou brodé\nTrès beau, jamais porté ')).toBe('Boubou brodé');
    expect(itemTitleFromCaption('x'.repeat(100), 20)).toHaveLength(20);
  });

  it('starters publish as a request or an opinion; anything else as a plain share', () => {
    expect(textIntent('seek')).toBe('seek');
    expect(textIntent('who_has')).toBe('seek');
    expect(textIntent('recommend')).toBe('opinion');
    expect(textIntent(null)).toBe('share');
  });
});
