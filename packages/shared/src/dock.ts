/** Tab bar auto-hide decision (P2). Pure so it is unit-tested; the mobile store lives in lib/dockVisibility.ts. */

/** Pixels of downward travel before the dock hides, and of upward travel before it returns. */
export const HIDE_AFTER = 10;
export const SHOW_AFTER = 4;
/** The dock never hides in the first screenful: there is nothing to make room for. */
export const HIDE_MIN_OFFSET = 80;
/** Distance from the end of the list that counts as « at the end ». */
export const END_ZONE = 32;

export interface ScrollSample {
  y: number;
  contentHeight: number;
  layoutHeight: number;
}

export function nextDockHidden(prevY: number, sample: ScrollSample, hidden: boolean): boolean {
  const { y, contentHeight, layoutHeight } = sample;
  if (contentHeight <= layoutHeight) return false; // nothing to scroll: nothing to hide for
  const atTop = y <= 0;
  const atEnd = contentHeight > layoutHeight && y + layoutHeight >= contentHeight - END_ZONE;
  if (atTop || atEnd) return false;
  const delta = y - prevY;
  if (delta >= HIDE_AFTER && y > HIDE_MIN_OFFSET) return true;
  if (delta <= -SHOW_AFTER) return false;
  return hidden;
}
