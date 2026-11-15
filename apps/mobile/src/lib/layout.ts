/**
 * Desktop web layout (W1.4). The phone experience is unchanged: native apps and any web window
 * narrower than 768 px get exactly the mobile layout (dock, full-width screens).
 *
 *  - mobile   < 768 px, or any native platform
 *  - compact  768–1099 px web: icon sidebar, no discovery rail
 *  - wide     ≥ 1100 px web: full sidebar, contextual rail on Accueil
 */
import { Platform, useWindowDimensions } from 'react-native';

export type LayoutMode = 'mobile' | 'compact' | 'wide';

export const DESKTOP_MIN = 768;
export const WIDE_MIN = 1100;

export function layoutFor(width: number, os: string = Platform.OS): LayoutMode {
  if (os !== 'web' || width < DESKTOP_MIN) return 'mobile';
  return width < WIDE_MIN ? 'compact' : 'wide';
}

export function useLayout() {
  const { width } = useWindowDimensions();
  const mode = layoutFor(width);
  return { mode, width, desktop: mode !== 'mobile', wide: mode === 'wide' };
}

/** Sidebar widths; content screens never need them, the shell lays them out. */
export const SIDEBAR_WIDE = 248;
export const SIDEBAR_COMPACT = 76;

/** react-native-web passes `hovered` to Pressable style callbacks; the native types do not declare it. */
export function isHovered(state: unknown): boolean {
  return !!(state as { hovered?: boolean }).hovered;
}

/** Phone-width column centred on desktop web (auth, onboarding): forms never stretch across a wide window. */
export function desktopColumn(desktop: boolean) {
  return desktop ? ({ width: '100%', maxWidth: 520, alignSelf: 'center' } as const) : undefined;
}
