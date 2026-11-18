import { describe, expect, it } from 'vitest';

import { looksLikeWhatsappPaste, parseAmount, parseWhatsappListing, whatsappCaption } from '../src/whatsapp';

describe('parseAmount', () => {
  it.each([
    ['30.000', 30000],
    ['12 500', 12500],
    ['30,000', 30000],
    ['30000', 30000],
    ['1.250.000', 1250000],
  ])('%s → %i', (raw, n) => expect(parseAmount(raw)).toBe(n));
  it('refuses what is not an amount', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('parseWhatsappListing (messages from a real WhatsApp fashion group)', () => {
  it('« Disponible / Size 37…45 / *Prix 30.000f » (blank line before the price)', () => {
    const r = parseWhatsappListing('Disponible\nSize 37-38-39-40-41-42-43-44-45\n\n*Prix 30.000f');
    expect(r.priceXof).toBe(30000);
    expect(r.sizes).toBe('37 à 45');
    expect(r.available).toBe(true);
    expect(r.mode).toBe('sale');
    expect(r.title).toBe('');
    expect(r.found).toBe(true);
  });

  it('a named article with a bare list of sizes and a price', () => {
    const r = parseWhatsappListing('Dior b30 full White\n40-41-42-43-44-45\n*Prix 35.000f');
    expect(r.title).toBe('Dior b30 full White');
    expect(r.sizes).toBe('40 à 45');
    expect(r.priceXof).toBe(35000);
    expect(whatsappCaption(r)).toBe('Dior b30 full White\nPointures : 40 à 45.');
  });

  it('a price alone, and « Pointure » with a list', () => {
    expect(parseWhatsappListing('Prix 20.000f').priceXof).toBe(20000);
    const r = parseWhatsappListing('*Prix 20.000\n\nPointure 37-38-39-40-41');
    expect(r.priceXof).toBe(20000);
    expect(r.sizes).toBe('37 à 41');
  });

  it('« à donner » makes it a gift with no price', () => {
    const r = parseWhatsappListing('Robe wax à donner, Médina');
    expect(r.mode).toBe('give');
    expect(r.priceXof).toBeNull();
    expect(r.found).toBe(true);
  });

  it('a price plus « troc possible » is a sale or swap', () => {
    const r = parseWhatsappListing('Tissu wax 6 yards\nPrix: 12 500 F CFA\ntroc possible');
    expect(r.priceXof).toBe(12500);
    expect(r.mode).toBe('sale_or_trade');
    expect(r.title).toBe('Tissu wax 6 yards');
    expect(r.description).toBe('troc possible');
  });

  it('letters for sizes and « 30k »', () => {
    expect(parseWhatsappListing('Chemise\nTaille S-M-L\nPrix 8k').sizes).toBe('S, M, L');
    expect(parseWhatsappListing('Sac\nPrix 25k').priceXof).toBe(25000);
  });

  it('strips a WhatsApp export prefix', () => {
    const r = parseWhatsappListing('[17:42, 09/11/2026] Binou: Sandales cuir\nPrix 12.000f');
    expect(r.title).toBe('Sandales cuir');
    expect(r.priceXof).toBe(12000);
  });

  it('counts the other priced articles of a multi-article paste and keeps the first', () => {
    const r = parseWhatsappListing('Sac rouge\nPrix 20.000f\n\nSac noir\nPrix 25.000f\n\nSac vert\nPrix 18.000f');
    expect(r.title).toBe('Sac rouge');
    expect(r.priceXof).toBe(20000);
    expect(r.extraBlocks).toBe(2);
  });

  it('ordinary text is not a listing', () => {
    const r = parseWhatsappListing('Bonjour, comment ça va ? On se voit demain à 17h.');
    expect(r.found).toBe(false);
    expect(r.priceXof).toBeNull();
  });
});

describe('looksLikeWhatsappPaste', () => {
  it('needs a block added at once, with a price or sizes', () => {
    expect(looksLikeWhatsappPaste('', 'Dior b30\nPrix 35.000f')).toBe(true);
    expect(looksLikeWhatsappPaste('Dior b30\nPrix 35.00', 'Dior b30\nPrix 35.000')).toBe(false); // typing
    expect(looksLikeWhatsappPaste('', 'Bonjour à toutes et à tous, belle journée')).toBe(false);
  });
});
