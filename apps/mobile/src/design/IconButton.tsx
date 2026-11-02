import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, touchTarget } from './theme';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: LucideIcon;
  label: string; // accessibility label (French)
  color?: string;
  size?: number;
  filled?: boolean;
  fillColor?: string;
  badge?: number;
  variant?: 'plain' | 'surface' | 'overlay';
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
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      <Icon size={size} color={color} strokeWidth={2} fill={filled ? (fillColor ?? color) : 'transparent'} />
      {badge ? (
        <View style={styles.badge} accessibilityLabel={`${badge} non lus`}>
          <Text variant="micro" color={colors.white} weight="700">
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
  overlay: { backgroundColor: 'rgba(16,37,44,0.45)' },
  badge: {
    position: 'absolute',
    top: 5,
    right: 3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
