/**
 * Jëfëli — one visual system (owner, 14 Nov 2026, P1 addendum). Every screen, on the phone, the
 * desktop and the public web pages, uses the same forest-dark canvas, the same two surfaces and
 * three accents with one job each:
 *   - gold  — every action and active state (primary buttons, active tab, « + », Waxaale offers)
 *             and everything Jëf;
 *   - mint  — Wecci and discovery tags only (`wecci`);
 *   - red   — unread badges, favourites, errors and live (`live` only for a real « EN DIRECT »).
 * This file is the ONLY place a colour value may be written (tests/no-raw-colors.test.ts).
 */
export const palette = {
  canvas: '#0B1311', // the one background: near-black with a slight green, so photos read true (owner, 15 Nov 2026)
  media: '#0B1311', // backdrop of every photo / media container: neutral, never tinted green
  surface: '#0B2922', // headers, sheets, panels, fields: the green surfaces stay for brand moments
  raised: '#12382F', // raised surfaces, active rows, own chat bubbles
  ink: '#F6F5ED', // primary text: warm off-white
  slate: '#9BADA7', // supporting copy
  stone: '#91A59F', // tertiary copy
  line: '#1C4137', // borders
  lineStrong: '#21463D',
  gold: '#EFBD38', // ACTION + Jëf
  goldPressed: '#F3C64D',
  onGold: '#0A2922', // text and icons on gold
  mint: '#7ED8BD', // WECCI + discovery tags
  red: '#DB4A35', // unread, favourites, errors
  live: '#D93A44', // ONLY a real « EN DIRECT »
  disabled: '#3C5C53',
  logoMint: '#A3E4D7', // the « Jëfëli. » logo letters only (unchanged brand asset)
  black: '#000000', // media stages (video, statuses) only
  white: '#FFFFFF', // text and icons over photos and video only
} as const;

/** Semantic tokens (mobile and web). Translucent values are derived from the palette above. */
export const colors = {
  background: palette.canvas,
  surface: palette.surface,
  surfaceSubtle: palette.surface,
  surfaceMuted: palette.raised,
  raised: palette.raised,
  ink: palette.ink,
  inkSoft: '#DCE3DE',
  textSecondary: palette.slate,
  textTertiary: palette.stone,
  border: palette.line,
  borderStrong: palette.lineStrong,
  // Action (gold)
  primary: palette.gold,
  onPrimary: palette.onGold,
  action: palette.gold,
  actionPressed: palette.goldPressed,
  actionText: palette.onGold,
  gold: palette.gold,
  goldSoft: 'rgba(239, 189, 56, 0.16)',
  goldLine: 'rgba(239, 189, 56, 0.32)',
  success: palette.gold,
  warning: palette.gold,
  warningSoft: 'rgba(239, 189, 56, 0.14)',
  // Wecci and discovery (mint)
  wecci: palette.mint,
  wecciSoft: 'rgba(126, 216, 189, 0.14)',
  // Attention (red)
  red: palette.red,
  danger: palette.red,
  dangerSoft: 'rgba(219, 74, 53, 0.16)',
  dangerPressed: 'rgba(219, 74, 53, 0.26)',
  live: palette.live,
  // Neutrals and overlays
  forest: palette.raised,
  disabled: palette.disabled,
  skeleton: palette.raised,
  darkBackground: palette.canvas,
  darkSurface: palette.surface,
  darkText: palette.ink,
  night: palette.canvas,
  logoMint: palette.logoMint,
  white: palette.white,
  black: palette.black,
  overlay: 'rgba(5, 9, 8, 0.62)',
  inkWash: 'rgba(246, 245, 237, 0.04)',
  glassLight: 'rgba(7, 31, 26, 0.95)',
  dockLight: 'rgba(7, 31, 26, 0.95)',
  dockLightBorder: 'rgba(214, 236, 228, 0.14)',
  // Over photos and video (statuses, live, media badges)
  mediaScrim: 'rgba(0, 0, 0, 0.45)',
  mediaScrimStrong: 'rgba(0, 0, 0, 0.6)',
  mediaClear: 'rgba(0, 0, 0, 0)',
  mediaText: 'rgba(255, 255, 255, 0.85)',
  mediaTextSoft: 'rgba(255, 255, 255, 0.75)',
  mediaLine: 'rgba(255, 255, 255, 0.35)',
  mediaChip: 'rgba(246, 245, 237, 0.94)', // light chip on a photo (favourite heart, badges)
  mediaPanel: 'rgba(11, 19, 17, 0.65)', // dark band over a photo
  mediaBackdrop: palette.media, // behind photos and videos (letterboxing, loading, empty)
} as const;

/** The same system under the names the screens already use. */
export const dark = {
  background: palette.canvas,
  surface: palette.surface,
  raised: palette.raised,
  text: palette.ink,
  textStrong: palette.ink,
  textSecondary: palette.slate,
  textTertiary: palette.stone,
  border: palette.line,
  borderStrong: palette.lineStrong,
  subtle: 'rgba(246, 245, 237, 0.05)',
  glass: 'rgba(11, 19, 17, 0.66)',
  glassBorder: 'rgba(214, 236, 228, 0.14)',
  dock: 'rgba(7, 31, 26, 0.95)',
  dockBorder: 'rgba(214, 236, 228, 0.14)',
  header: 'rgba(11, 19, 17, 0.94)',
  scrim: 'rgba(5, 9, 8, 0.9)',
  scrimSoft: 'rgba(5, 9, 8, 0.6)',
  gold: palette.gold,
  goldSoft: 'rgba(239, 189, 56, 0.15)',
  goldLine: 'rgba(239, 189, 56, 0.3)',
  wecci: palette.mint,
  wecciSoft: 'rgba(126, 216, 189, 0.1)',
  danger: palette.red,
  red: palette.red,
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
/** Shape (P1 addendum): cards 20, chips and buttons pill-shaped, sheets 25. */
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 20, card: 20, sheet: 25, pill: 999 } as const;

export const typeScale = {
  display: { size: 30, line: 36, weight: '800' as const, tracking: -0.8 },
  title: { size: 22, line: 28, weight: '700' as const, tracking: -0.4 },
  headline: { size: 17, line: 23, weight: '700' as const, tracking: -0.2 },
  price: { size: 20, line: 26, weight: '800' as const, tracking: -0.4 },
  body: { size: 15, line: 22, weight: '400' as const, tracking: 0 },
  bodyStrong: { size: 15, line: 22, weight: '600' as const, tracking: 0 },
  callout: { size: 14, line: 20, weight: '500' as const, tracking: 0 },
  caption: { size: 12.5, line: 17, weight: '500' as const, tracking: 0 },
  micro: { size: 11, line: 14, weight: '600' as const, tracking: 0.2 },
} as const;

/** Minimum touch target (iOS HIG 44pt / Android 48dp). */
export const touchTarget = 44;
