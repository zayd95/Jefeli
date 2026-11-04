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
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 6, sm: 8, md: 12, lg: 14, xl: 20, pill: 999 } as const;

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
