import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, dark, touchTarget } from './theme';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: LucideIcon;
  label: string; // accessibility label (French)
  color?: string;
  size?: number;
  filled?: boolean;
  fillColor?: string;
  badge?: number;
  /** glass = Lovable `.lab-glass` round button on dark/photo surfaces. */
  variant?: 'plain' | 'surface' | 'overlay' | 'glass';
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon: Icon,
  label,
  color = colors.ink,
  size = 22,
  filled,
  fillColor,
  badge,
  variant = 'plain',
  style,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' && styles.surface,
        variant === 'overlay' && styles.overlay,
        variant === 'glass' && styles.glass,
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      <Icon size={size} color={color} strokeWidth={2} fill={filled ? (fillColor ?? color) : 'transparent'} />
      {badge ? (
        <View style={[styles.badge, (variant === 'surface' || variant === 'glass') && styles.badgeOnSurface, variant === 'glass' && styles.badgeOnGlass]} accessibilityLabel={`${badge} non lus`}>
          <Text variant="micro" color={variant === 'glass' ? colors.night : colors.white} weight="700">
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: touchTarget / 2 },
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  overlay: { backgroundColor: colors.overlay },
  glass: { width: 40, height: 40, borderRadius: 20, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  badgeOnGlass: { backgroundColor: colors.mint, borderColor: dark.background },
  badgeOnSurface: { top: -4, right: -4 },
  badge: {
    position: 'absolute',
    top: 5,
    right: 3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
