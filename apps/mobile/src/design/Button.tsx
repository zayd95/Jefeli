import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius, touchTarget } from './theme';

type Variant = 'primary' | 'cta' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palettes: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink, bgPressed: colors.inkSoft, fg: colors.white },
  cta: { bg: colors.action, bgPressed: colors.actionPressed, fg: colors.actionText },
  outline: { bg: 'transparent', bgPressed: colors.surfaceSubtle, fg: colors.ink, border: colors.borderStrong },
  ghost: { bg: 'transparent', bgPressed: colors.surfaceSubtle, fg: colors.ink },
  danger: { bg: colors.dangerSoft, bgPressed: '#F6D6D8', fg: colors.danger },
  soft: { bg: colors.surfaceSubtle, bgPressed: colors.surfaceMuted, fg: colors.ink },
};

const heights: Record<Size, number> = { sm: 36, md: touchTarget + 2, lg: 52 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: ButtonProps) {
  const p = palettes[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }} aria-disabled={!!isDisabled} aria-busy={!!loading}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : 0}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: size === 'sm' ? 14 : 18,
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: isDisabled && !loading ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={size === 'sm' ? 16 : 18} color={p.fg} strokeWidth={2.2} /> : null}
          <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} weight="700" color={p.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
