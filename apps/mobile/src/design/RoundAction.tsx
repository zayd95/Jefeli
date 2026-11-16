import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, dark } from './theme';

/** Minimum touch target of an icon action (P2): 44 pt. */
export const ROUND_ACTION = 44;

export interface RoundActionProps {
  icon: LucideIcon;
  /** French accessibility label; also the text shown on a long press. */
  label: string;
  onPress: () => void;
  /** Selected / on state (saved, shared…): raised fill + gold border, ink icon. */
  active?: boolean;
  /** Filled icon when active (heart, bookmark). */
  filled?: boolean;
  /** `overlay` = on a photo or video (glass); `surface` = on the page (default). */
  variant?: 'surface' | 'overlay';
  count?: number | null;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One round icon button (P2): 44 pt minimum, never a long text button. Its label is the
 * accessibility label and appears in a small bubble on a long press (a hover title on web), so an
 * icon is never a guess. Gold is not used here: the gold pill next to it is the one primary action.
 */
export function RoundAction({ icon: Icon, label, onPress, active, filled, variant = 'surface', count, disabled, testID, style }: RoundActionProps) {
  const [tip, setTip] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const overlay = variant === 'overlay';
  const web = Platform.OS === 'web' ? ({ title: label } as object) : null;
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active, disabled: !!disabled }}
        aria-pressed={active ?? undefined}
        disabled={disabled}
        testID={testID}
        onPress={onPress}
        onLongPress={() => {
          setTip(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setTip(false), 1600);
        }}
        delayLongPress={350}
        {...web}
        style={({ pressed }) => [
          styles.base,
          overlay ? styles.overlay : styles.surface,
          active && styles.active,
          pressed && { opacity: 0.65, transform: [{ scale: 0.96 }] },
          disabled && { opacity: 0.45 },
        ]}
      >
        <Icon size={20} strokeWidth={2} color={active && !overlay ? colors.gold : overlay ? dark.text : colors.ink} fill={filled && active ? (overlay ? dark.text : colors.gold) : 'transparent'} />
        {count ? (
          <Text variant="micro" weight="700" color={overlay ? dark.text : colors.ink} style={styles.count}>
            {count > 99 ? '99+' : count}
          </Text>
        ) : null}
      </Pressable>
      {tip ? (
        <View pointerEvents="none" style={styles.tip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text variant="micro" weight="700" color={dark.text} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', zIndex: 2 },
  base: { minWidth: ROUND_ACTION, height: ROUND_ACTION, borderRadius: ROUND_ACTION / 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  overlay: { backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  active: { backgroundColor: colors.raised, borderColor: colors.gold },
  count: { marginRight: 2 },
  tip: { position: 'absolute', bottom: ROUND_ACTION + 6, alignSelf: 'center', minWidth: 64, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: dark.raised, borderWidth: 1, borderColor: dark.glassBorder, alignItems: 'center', justifyContent: 'center' },
});
