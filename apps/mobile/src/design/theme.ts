import { colors, dark, radius, spacing, typeScale, touchTarget, palette } from '@jefeli/shared';
import { type TextStyle, type ViewStyle } from 'react-native';

export { colors, dark, radius, spacing, typeScale, touchTarget, palette };

/**
 * Typography (P1 addendum, owner 14 Nov 2026): one rounded typeface, Nunito, everywhere.
 *   - headings 800 / 900 (the `serif` prop on <Text> now means « heading »: Nunito ExtraBold);
 *   - UI labels 600 / 700;
 *   - body 400.
 * Each weight ships as its own family on native.
 */
export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  serif: 'Nunito_800ExtraBold',
  serifSemibold: 'Nunito_800ExtraBold',
  serifItalic: 'Nunito_800ExtraBold_Italic',
} as const;

/** Headings: ExtraBold, or Black when 900 is asked for. */
export function serifFor(weight: TextStyle['fontWeight']): string {
  return weight === '900' ? fonts.black : fonts.extrabold;
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
      return fonts.extrabold;
    case '900':
      return fonts.black;
    default:
      return fonts.regular;
  }
}

/**
 * No shadows (P1 addendum): on one dark canvas, depth comes from the two surfaces and a hairline
 * border, never from a drop shadow. The names stay so existing styles keep compiling.
 */
export const shadow = {
  paper: {} as ViewStyle,
  card: {} as ViewStyle,
  floating: {} as ViewStyle,
};

export const hairline = 1;
