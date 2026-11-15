/**
 * Jëfëli — « Dakar after dark » design tokens (owner-approved direction, 12 Nov 2026):
 * a premium dark marketplace. Deep forest greens, Senegalese gold for anything active or
 * commerce-related, mint for discovery, red only for attention, warm off-white text.
 * Single source of truth for mobile and web.
 */
export const palette = {
  canvas: '#061D18', // main page background (deep forest green)
  ink: '#F6F5ED', // primary text: warm off-white, never pure white
  mint: '#A3E4D7', // brand mint (logo letters)
  mintAccent: '#7ED8BD', // discovery accents: italic highlights, category and meta icons
  slate: '#9BADA7', // supporting copy
  surface: '#0B2922', // product cards, panels
  night: '#061D18',
  deep: '#0B2922',
  raised: '#12382F', // secondary active surfaces
  forest: '#0D3A30', // deep green buttons
  fog: '#F6F5ED',
  gold: '#EFBD38', // Senegalese gold: active, primary action, publish, eyebrows
  goldLight: '#F3CA5B',
  red: '#DB4A35', // notifications, favourites, Senegalese identity details
  live: '#D93A44', // ONLY for a real « EN DIRECT » state
} as const;

/**
 * Semantic tokens. The former light commerce surfaces (Explorer, article, forms) now share the
 * dark foundation; names are kept so every screen follows without a rewrite.
 * `ink` is the main TEXT colour; filled primary actions use `primary` (gold) with `onPrimary`.
 */
export const colors = {
  background: palette.canvas,
  surface: palette.surface,
  surfaceSubtle: '#0C2A23', // search fields, chips
  surfaceMuted: '#12382F', // condition chips, skeleton base
  ink: palette.ink,
  inkSoft: '#DCE3DE',
  textSecondary: palette.slate,
  textTertiary: '#91A59F',
  border: '#1C4137',
  borderStrong: '#21463D',
  action: palette.gold,
  actionPressed: '#F3C64D',
  actionText: '#0A2922',
  primary: palette.gold, // filled primary actions (« Vendre », publish, main CTA)
  onPrimary: '#0A2922', // dark green on gold
  forest: palette.forest, // deep green secondary buttons
  mintSoft: 'rgba(126, 216, 189, 0.14)', // own message bubbles, soft highlights
  accentDeep: palette.mintAccent, // links and accents on dark
  danger: '#E2604E',
  dangerSoft: 'rgba(219, 74, 53, 0.14)',
  live: palette.live,
  red: palette.red,
  success: '#4FBF95',
  warning: palette.goldLight,
  warningSoft: 'rgba(239, 189, 56, 0.14)',
  disabled: '#3C5C53',
  skeleton: '#12382F',
  darkBackground: palette.night,
  darkSurface: palette.deep,
  darkText: palette.fog,
  gold: palette.gold,
  overlay: 'rgba(2, 14, 11, 0.62)',
  white: '#FFFFFF',
  night: palette.night,
  mint: palette.mint,
  mintAccent: palette.mintAccent,
  goldSoft: 'rgba(239, 189, 56, 0.16)',
  inkWash: 'rgba(246, 245, 237, 0.04)', // payment disclaimer box
  glassLight: 'rgba(7, 31, 26, 0.95)', // sticky bars
  dockLight: 'rgba(7, 31, 26, 0.95)',
  dockLightBorder: 'rgba(214, 236, 228, 0.14)',
} as const;

/** Dark surfaces (Home, Profile, Messages and now every screen). */
export const dark = {
  background: palette.night,
  surface: palette.deep,
  raised: palette.raised,
  text: palette.fog,
  textStrong: '#F5F5EC',
  textSecondary: '#9BADA7',
  textTertiary: '#91A59F',
  border: '#1C4137',
  borderStrong: '#22483E',
  subtle: 'rgba(246, 245, 237, 0.05)',
  glass: 'rgba(6, 29, 24, 0.66)',
  glassBorder: 'rgba(214, 236, 228, 0.14)',
  dock: 'rgba(7, 31, 26, 0.95)',
  dockBorder: 'rgba(214, 236, 228, 0.14)',
  header: 'rgba(6, 29, 24, 0.94)',
  scrim: 'rgba(2, 14, 11, 0.9)',
  scrimSoft: 'rgba(2, 14, 11, 0.6)',
  mint: palette.mintAccent,
  mintSoft: 'rgba(126, 216, 189, 0.08)',
  mintLine: 'rgba(126, 216, 189, 0.22)',
  mintSelected: palette.raised,
  gold: palette.gold,
  goldSoft: 'rgba(239, 189, 56, 0.15)',
  goldLine: 'rgba(239, 189, 56, 0.3)',
  danger: '#F08E7F',
  red: palette.red,
} as const;

/**
 * Explorer stays a white commercial page (owner, 12 Nov 2026): near-white canvas, white cards,
 * ink text. Gold stays the active / primary colour there too.
 */
export const light = {
  background: '#FAFBFA',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F4F2',
  surfaceMuted: '#E6ECE8',
  ink: '#10252C',
  textSecondary: '#607071', // 4.9:1 on the canvas
  textTertiary: '#6B7A7B',
  border: '#E2E6E4',
  borderStrong: '#C9D3CE',
  accent: '#2E8C73', // mint-family icons and links with 4.5:1 on white
  accentSoft: '#D7F1E9',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 6, sm: 8, md: 12, lg: 15, xl: 16, xxl: 20, sheet: 25, pill: 999 } as const;

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
