import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors, fontFor, typeScale } from './theme';

type Variant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  tone?: 'default' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'accent';
}

const toneColor: Record<NonNullable<AppTextProps['tone']>, string> = {
  default: colors.ink,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.white,
  danger: colors.danger,
  accent: colors.accentDeep,
};

export function Text({ variant = 'body', color, weight, align, tone = 'default', style, ...rest }: AppTextProps) {
  const t = typeScale[variant];
  const w = weight ?? t.weight;
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          fontFamily: fontFor(w),
          fontSize: t.size,
          lineHeight: t.line,
          letterSpacing: t.tracking,
          color: color ?? toneColor[tone],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
