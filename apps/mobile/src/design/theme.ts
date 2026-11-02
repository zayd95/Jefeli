import { colors, radius, spacing, typeScale, touchTarget, palette } from '@jefeli/shared';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export { colors, radius, spacing, typeScale, touchTarget, palette };

/** Inter ships every weight as its own family on native. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

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
