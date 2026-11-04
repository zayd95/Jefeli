import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, dark, fontFor, serifFor, typeScale } from './theme';

type Variant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  tone?: 'default' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'accent' | 'fog' | 'fogSecondary' | 'fogTertiary' | 'gold' | 'mint';
  /** Editorial display face (Fraunces), as Lovable's `font-display` headlines and quotes. */
  serif?: boolean;
}

const toneColor: Record<NonNullable<AppTextProps['tone']>, string> = {
  default: colors.ink,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.white,
  danger: colors.danger,
  accent: colors.accentDeep,
  // Atlantic After Dark (Home, Profile, Messages)
  fog: dark.text,
  fogSecondary: dark.textSecondary,
  fogTertiary: dark.textTertiary,
  gold: dark.gold,
  mint: dark.mint,
};

export function Text({ variant = 'body', color, weight, align, tone = 'default', serif, style, ...rest }: AppTextProps) {
  const t = typeScale[variant];
  const w = weight ?? (serif ? '600' : t.weight);
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          fontFamily: serif ? serifFor(w) : fontFor(w),
          fontSize: t.size,
          lineHeight: t.line,
          letterSpacing: serif ? -t.size * 0.015 : t.tracking,
          color: color ?? toneColor[tone],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
