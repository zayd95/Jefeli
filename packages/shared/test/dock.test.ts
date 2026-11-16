import { describe, expect, it } from 'vitest';

import { HIDE_AFTER, nextDockHidden } from '../src/dock';

const list = { contentHeight: 3000, layoutHeight: 800 };

describe('nextDockHidden', () => {
  it('stays visible in the first screenful', () => {
    expect(nextDockHidden(0, { y: 60, ...list }, false)).toBe(false);
  });
  it('hides after a real scroll down', () => {
    expect(nextDockHidden(200, { y: 200 + HIDE_AFTER, ...list }, false)).toBe(true);
  });
  it('ignores jitter smaller than the threshold', () => {
    expect(nextDockHidden(200, { y: 204, ...list }, false)).toBe(false);
  });
  it('comes back on any scroll up', () => {
    expect(nextDockHidden(600, { y: 595, ...list }, true)).toBe(false);
  });
  it('stays hidden while still scrolling down', () => {
    expect(nextDockHidden(600, { y: 603, ...list }, true)).toBe(true);
  });
  it('comes back at the top and at the end of the list', () => {
    expect(nextDockHidden(300, { y: 0, ...list }, true)).toBe(false);
    expect(nextDockHidden(2100, { y: 2190, ...list }, true)).toBe(false);
  });
  it('never hides a list that fits the screen', () => {
    expect(nextDockHidden(0, { y: 120, contentHeight: 700, layoutHeight: 800 }, false)).toBe(false);
  });
});
