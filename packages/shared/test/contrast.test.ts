/**
 * WCAG 2.1 AA contrast for the text/background pairs the one visual system uses
 * (P1 addendum). Normal text needs 4.5:1, large text (≥ 18.66 px bold / 24 px) and
 * non-text UI (icons, borders of controls) 3:1.
 */
import { describe, expect, it } from 'vitest';

import { palette } from '../src/tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const { canvas, surface, raised, ink, slate, stone, gold, onGold, mint, red, live, white, black, sand, sandInk, sandMuted, clay } = palette;

/** [foreground, background, minimum, where it is used] */
const PAIRS: [string, string, number, string][] = [
  [ink, canvas, 4.5, 'body text on the canvas'],
  [ink, surface, 4.5, 'body text on cards'],
  [ink, raised, 4.5, 'own chat bubbles, active rows'],
  [slate, canvas, 4.5, 'secondary text on the canvas'],
  [slate, surface, 4.5, 'secondary text on cards'],
  [slate, raised, 4.5, 'secondary text on raised rows'],
  [stone, canvas, 4.5, 'tertiary text on the canvas'],
  [stone, surface, 4.5, 'tertiary text on cards'],
  [onGold, gold, 4.5, 'labels on gold buttons, the active tab, Waxaale band'],
  [gold, canvas, 4.5, 'gold links and active labels on the canvas'],
  [gold, surface, 4.5, 'gold labels on cards'],
  [gold, raised, 4.5, 'gold labels on raised rows'],
  [mint, canvas, 4.5, 'Wecci and discovery tag labels'],
  [mint, surface, 4.5, 'Wecci tags on cards'],
  [onGold, mint, 4.5, 'text on the Wecci badge'],
  [white, red, 3, 'unread count on the red badge (bold, small: non-text UI threshold)'],
  [red, canvas, 3, 'red icons: favourites, errors'],
  [white, live, 3, '« EN DIRECT » label (bold)'],
  [white, black, 4.5, 'captions over video'],
  [sandInk, sand, 4.5, 'Demande d’aide: request text on the sand card'],
  [sandMuted, sand, 4.5, 'Demande d’aide: author line, eyebrow, hints on the sand card'],
  [sand, sandInk, 4.5, 'Demande d’aide: « Je peux aider » label on its deep-ink pill'],
  [clay, sand, 3, 'Demande d’aide: clay dot and hairline (non-text UI threshold)'],
];

describe('WCAG AA contrast of the token pairs', () => {
  for (const [fg, bg, min, where] of PAIRS) {
    it(`${where}: ${fg} on ${bg} ≥ ${min}:1`, () => {
      expect(Number(contrast(fg, bg).toFixed(2))).toBeGreaterThanOrEqual(min);
    });
  }
});
