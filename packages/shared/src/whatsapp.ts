/**
 * « Coller depuis WhatsApp » (P3): sellers already announce their articles in WhatsApp groups with
 * one-line captions (« Disponible / Size 37-45 / *Prix 30.000f »). The Studio reads such a pasted
 * block and fills the article for them: name, price, sizes (kept in the description), and the
 * Wecci mode when the text says « à donner » or « troc ». One pure function, no network, no new button.
 *
 * It only fills, never publishes: the member sees the result in the composer and can undo it.
 */

export interface WhatsappListing {
  /** First free line (the article name), '' when the block has none. */
  title: string;
  /** Remaining free text, with the sizes appended as « Pointures : 37 à 45. ». */
  description: string;
  priceXof: number | null;
  /** « 37 à 45 », « S, M, L » … */
  sizes: string | null;
  /** 'give' when the text offers the article, 'sale_or_trade' / 'trade' when it mentions a swap. */
  mode: 'sale' | 'sale_or_trade' | 'trade' | 'give' | null;
  /** The text said « disponible ». */
  available: boolean;
  /** Blocks after the first one that also carry a price (a multi-article paste). */
  extraBlocks: number;
  /** A price or sizes were recognised: worth offering to fill the article. */
  found: boolean;
  /** Short French summary of what was recognised, for the inline note. */
  summary: string;
}

const MAX_PRICE = 100_000_000;

/** « 30.000 », « 12 500 », « 30,000 », « 30000 » → 30000 ; « 30k » handled by the caller. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/ /g, ' ');
  if (!s) return null;
  let digits: string;
  if (/^\d{1,3}([.,\s]\d{3})+$/.test(s)) digits = s.replace(/[.,\s]/g, '');
  else if (/^\d+$/.test(s)) digits = s;
  else if (/^\d+[.,]\d{1,2}$/.test(s)) digits = s.replace(/[.,]\d{1,2}$/, '');
  else return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 1 && n <= MAX_PRICE ? n : null;
}

const PRICE_AFTER_WORD = /(?:^|[^a-zà-ÿ])(?:prix|price|px)\s*[:=\-–]?\s*(\d[\d\s.,]*\d|\d)\s*(k|f\s*cfa|fcfa|cfa|xof|francs?|f)?(?![a-z0-9])/i;
const PRICE_WITH_UNIT = /(\d[\d\s.,]*\d|\d)\s*(k|f\s*cfa|fcfa|cfa|xof|francs?|f)\b/i;
const SIZE_WORD = /^(?:size|sizes|taille|tailles|pointure|pointures)\s*[:=\-–]?\s*(.+)$/i;
const SIZE_NUMBERS_ONLY = /^\d{2}(?:\s*[-–/,.\s]\s*\d{2}){2,}$/;
const SIZE_LETTERS = /^(?:xxs|xs|s|m|l|xl|xxl|xxxl)(?:\s*[-–/,]\s*(?:xxs|xs|s|m|l|xl|xxl|xxxl))+$/i;
const AVAILABLE = /^(?:disponible|dispo|en stock|available)\b/i;
// \b does not work before « à » or « é »: explicit letter boundaries.
const GIVE = /(?<![a-zà-ÿ])(?:à donner|a donner|je donne|gratuit|offert|don gratuit)(?![a-zà-ÿ])/i;
const SWAP = /(?<![a-zà-ÿ])(?:troc|troquer|échange|echange|j['’]échange|j['’]echange)(?![a-zà-ÿ])/i;
// A WhatsApp export line: « [17:42, 09/11/2026] Binou: » or « 17:42 - Binou: ».
const EXPORT_PREFIX = /^\s*\[?\d{1,2}[:h]\d{2}[^\]\-:]{0,30}[\]\-]\s*[^:]{1,40}:\s*/;

/** Sizes as short text: « 37 à 45 » for a consecutive run of 4+ numbers, otherwise the list. */
function formatSizes(raw: string): string | null {
  const cleaned = raw.replace(/[*_~]/g, '').trim();
  const nums = cleaned.match(/\d{2}/g);
  if (nums && nums.length >= 3 && /^[\d\s\-–/,.]+$/.test(cleaned)) {
    const n = nums.map(Number).sort((a, b) => a - b);
    const consecutive = n.every((v, i) => i === 0 || v - n[i - 1]! === 1);
    return consecutive && n.length >= 4 ? `${n[0]} à ${n[n.length - 1]}` : n.join(', ');
  }
  const letters = cleaned.split(/\s*[-–/,]\s*/).filter(Boolean);
  if (letters.length && letters.every((l) => /^(?:xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(l))) return letters.map((l) => l.toUpperCase()).join(', ');
  return cleaned.length <= 40 ? cleaned : null;
}

function clean(line: string): string {
  return line.replace(EXPORT_PREFIX, '').replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

export function parseWhatsappListing(raw: string): WhatsappListing {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  // A listing is often split in two by a blank line (« Disponible / Size … » then « *Prix … »): glue
  // the blocks that carry no price to the next one, then the first group with a price is the article.
  const groups: string[] = [];
  let pending: string[] = [];
  const priced = (b: string) => PRICE_AFTER_WORD.test(b) || PRICE_WITH_UNIT.test(b);
  const detailOnly = (b: string) => b.split('\n').map(clean).filter(Boolean).every((l) => SIZE_WORD.test(l) || SIZE_NUMBERS_ONLY.test(l) || SIZE_LETTERS.test(l) || (AVAILABLE.test(l) && l.length <= 24));
  for (const b of blocks) {
    // Sizes or « disponible » right after a priced block belong to that article.
    if (!pending.length && groups.length && !priced(b) && detailOnly(b)) {
      groups[groups.length - 1] += `\n${b}`;
      continue;
    }
    pending.push(b);
    if (priced(b)) {
      groups.push(pending.join('\n'));
      pending = [];
    }
  }
  if (pending.length) groups.push(pending.join('\n'));
  const first = groups[0] ?? text;
  const extraBlocks = groups.slice(1).filter((g) => PRICE_AFTER_WORD.test(g) || PRICE_WITH_UNIT.test(g)).length;

  let priceXof: number | null = null;
  let sizes: string | null = null;
  let available = false;
  const free: string[] = [];
  for (const rawLine of first.split('\n')) {
    const line = clean(rawLine);
    if (!line) continue;
    if (AVAILABLE.test(line) && line.length <= 24) {
      available = true;
      continue;
    }
    const sw = line.match(SIZE_WORD);
    if (sw && sizes === null) {
      sizes = formatSizes(sw[1]!);
      if (sizes) continue;
    }
    if ((SIZE_NUMBERS_ONLY.test(line) || SIZE_LETTERS.test(line)) && sizes === null) {
      sizes = formatSizes(line);
      if (sizes) continue;
    }
    if (priceXof === null) {
      const pw = line.match(PRICE_AFTER_WORD);
      const pu = pw ? null : line.match(PRICE_WITH_UNIT);
      const m = pw ?? pu;
      if (m) {
        const unit = (m[2] ?? '').toLowerCase();
        const base = unit === 'k' ? parseAmount(m[1]!.replace(',', '.').replace(/\s/g, '')) : parseAmount(m[1]!);
        const n = unit === 'k' && base !== null && base < 1000 ? base * 1000 : base;
        if (n !== null) {
          priceXof = n;
          const rest = line.replace(m[0], ' ').replace(/\s+/g, ' ').trim().replace(/^[-–:,.]+|[-–:,.]+$/g, '').trim();
          if (rest.length >= 3) free.push(rest);
          continue;
        }
      }
    }
    free.push(line);
  }

  const whole = clean(first.replace(/\n/g, ' '));
  const mode: WhatsappListing['mode'] = GIVE.test(whole) ? 'give' : SWAP.test(whole) ? (priceXof === null ? 'trade' : 'sale_or_trade') : priceXof !== null ? 'sale' : null;
  const title = free[0] && free[0].length <= 90 ? free[0] : (free[0] ?? '').slice(0, 90);
  const descLines = free.slice(title ? 1 : 0);
  if (sizes) descLines.push(`Pointures : ${sizes}.`.replace('Pointures : ', /[a-z]/i.test(sizes) ? 'Tailles : ' : 'Pointures : '));
  const found = priceXof !== null || sizes !== null || mode === 'give';

  const parts: string[] = [];
  if (priceXof !== null) parts.push(`prix ${priceXof.toLocaleString('fr-FR').replace(/ | /g, ' ')} F`);
  if (sizes) parts.push(/[a-z]/i.test(sizes) ? `tailles ${sizes}` : `pointures ${sizes}`);
  if (mode === 'give') parts.push('à donner');
  else if (mode === 'trade' || mode === 'sale_or_trade') parts.push('troc possible');
  return {
    title,
    description: descLines.join('\n'),
    priceXof: mode === 'give' ? null : priceXof,
    sizes,
    mode,
    available,
    extraBlocks,
    found,
    summary: parts.length ? `Reconnu : ${parts.join(', ')}.` : '',
  };
}

/** The caption the Studio shows after a paste: the name on the first line, then the description. */
export function whatsappCaption(p: WhatsappListing): string {
  return [p.title, p.description].filter(Boolean).join('\n');
}

/**
 * Was this change of the caption a paste of a WhatsApp-style announcement? A paste adds a whole block at
 * once; typing adds one character. Only a block that carries a price or sizes counts.
 */
export function looksLikeWhatsappPaste(before: string, after: string): boolean {
  if (after.length - before.length < 16) return false;
  return parseWhatsappListing(after).found;
}
