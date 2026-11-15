import { colors, dark, light, radius, spacing, typeScale, touchTarget, palette } from '@jefeli/shared';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export { colors, dark, light, radius, spacing, typeScale, touchTarget, palette };

/**
 * Typography: DM Sans for the interface, DM Serif Display for editorial headings
 * display text (`font-display`). Each weight ships as its own family on native.
 */
export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extrabold: 'DMSans_800ExtraBold',
  // DM Serif Display ships one weight: editorial headings, product names, wordmark.
  serif: 'DMSerifDisplay_400Regular',
  serifSemibold: 'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
} as const;

export function serifFor(weight: TextStyle['fontWeight']): string {
  return weight === '400' || weight === 'normal' || weight === '300' || weight === '500' ? fonts.serif : fonts.serifSemibold;
}

export function fontFor(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '500':
      return fonts.medium;
    case '600':
      return fonts.semibold;
    case '700':
    case 'bold':
      return fonts.bold;
    case '800':
    case '900':
      return fonts.extrabold;
    default:
      return fonts.regular;
  }
}

export const shadow = {
  /** Lovable light product card: `0 8px 24px -16px ink/35`. */
  paper: Platform.select<ViewStyle>({
    ios: { shadowColor: '#10252C', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 8px 24px -16px rgba(16,37,44,0.35)' } as ViewStyle,
  }),
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#10252C', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 1 },
    default: { boxShadow: '0 3px 10px rgba(16,37,44,0.06)' } as ViewStyle,
  }),
  floating: Platform.select<ViewStyle>({
    ios: { shadowColor: '#10252C', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 6 },
    default: { boxShadow: '0 8px 24px rgba(16,37,44,0.14)' } as ViewStyle,
  }),
};

export const hairline = 1;
