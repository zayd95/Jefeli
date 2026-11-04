/**
 * Jëfëli — Atlantic Sand design tokens (owner-approved palette 4).
 * Single source of truth for mobile and web.
 */
export const palette = {
  canvas: '#FAFBFA', // owner-approved near-white canvas, matches latest Lovable light pages
  ink: '#10252C', // Atlantic Ink: text, dark surfaces, wordmark
  mint: '#A3E4D7', // Frosted Mint: follow / CTA / selected
  slate: '#607071', // secondary text, metadata
  surface: '#FFFFFF', // cards, sheets
  night: '#091B19', // approved Atlantic After Dark home and social profile surface
  deep: '#122B26', // secondary atmospheric dark-card surfaces
  fog: '#F7F6F3', // warm-but-clean foreground on Atlantic night
  gold: '#E3B777', // restrained editorial accent
  live: '#D93A44', // accessible red, ONLY for a real "EN DIRECT" state
} as const;

/** Semantic tokens. Derived tints keep contrast within WCAG AA for their usage. */
export const colors = {
  background: palette.canvas,
  surface: palette.surface,
  surfaceSubtle: '#F1F4F2', // understated near-white search field and chips
  surfaceMuted: '#E6ECE8', // condition chips, skeleton base
  ink: palette.ink,
  inkSoft: '#2B4148', // pressed ink buttons, secondary dark text
  textSecondary: palette.slate, // 4.9:1 on canvas
  textTertiary: '#7C8A8B', // timestamps on white only (3.6:1 — large/bold text)
  border: '#E2E6E4',
  borderStrong: '#C9D3CE',
  action: palette.mint,
  actionPressed: '#8ED8C9',
  actionText: palette.ink, // ink on mint = 11.4:1
  mintSoft: '#D7F1E9', // own message bubbles, soft highlights
  accentDeep: '#2E8C73', // mint-family accent with 4.5:1 on white (links, wordmark dot)
  danger: '#C2333D',
  dangerSoft: '#FBE9EA',
  live: palette.live,
  success: '#2E7D5B',
  warning: '#9A6A00',
  warningSoft: '#FFF4D6',
  disabled: '#B9C3C0',
  skeleton: '#E7ECE9',
  darkBackground: palette.night,
  darkSurface: palette.deep,
  darkText: palette.fog,
  gold: palette.gold,
  overlay: 'rgba(16, 37, 44, 0.55)',
  white: '#FFFFFF',
  // Lovable light commerce surfaces (Explorer, product, forms)
  night: palette.night,
  mint: palette.mint,
  goldSoft: 'rgba(227, 183, 119, 0.25)', // « À discuter » pill on white
  inkWash: 'rgba(16, 37, 44, 0.04)', // payment disclaimer box
  glassLight: 'rgba(255, 255, 255, 0.94)', // sticky product CTA bar, light dock
  dockLight: 'rgba(250, 251, 250, 0.95)',
  dockLightBorder: 'rgba(255, 255, 255, 0.7)',
} as const;

/**
 * Atlantic After Dark surfaces (Home, member Profile, Messages), ported from the approved
 * Lovable lab (--lab-night / --lab-deep / --lab-fog tints). Fog tints keep AA contrast for
 * body (≥ 0.62) and large/bold meta text (≥ 0.48) on #091B19.
 */
export const dark = {
  background: palette.night,
  surface: palette.deep, // patterned text cards, panels, boutique tiles
  raised: '#183530', // skeleton highlight, pressed rows
  text: palette.fog,
  textStrong: 'rgba(247, 246, 243, 0.9)',
  textSecondary: 'rgba(247, 246, 243, 0.62)',
  textTertiary: 'rgba(247, 246, 243, 0.48)',
  border: 'rgba(247, 246, 243, 0.10)',
  borderStrong: 'rgba(247, 246, 243, 0.18)',
  subtle: 'rgba(247, 246, 243, 0.06)',
  glass: 'rgba(9, 27, 25, 0.62)',
  glassBorder: 'rgba(247, 246, 243, 0.12)',
  dock: 'rgba(9, 27, 25, 0.92)',
  dockBorder: 'rgba(247, 246, 243, 0.15)',
  header: 'rgba(9, 27, 25, 0.96)',
  scrim: 'rgba(9, 27, 25, 0.92)',
  scrimSoft: 'rgba(9, 27, 25, 0.6)',
  mint: palette.mint,
  mintSoft: 'rgba(163, 228, 215, 0.08)',
  mintLine: 'rgba(163, 228, 215, 0.22)',
  mintSelected: 'rgba(163, 228, 215, 0.12)',
  gold: palette.gold,
  goldSoft: 'rgba(227, 183, 119, 0.15)',
  goldLine: 'rgba(227, 183, 119, 0.28)',
  danger: '#F09A9F',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 6, sm: 8, md: 12, lg: 14, xl: 20, xxl: 24, sheet: 28, pill: 999 } as const;

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
