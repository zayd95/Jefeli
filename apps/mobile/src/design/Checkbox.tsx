import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from './theme';

export function Checkbox({
  checked,
  onToggle,
  label,
  description,
  link,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  link?: { label: string; onPress: () => void };
}) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} accessibilityLabel={label} style={[styles.check, !description && !link && styles.checkSingle]}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Check size={16} color={colors.white} strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight={description ? '600' : '400'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
        {link ? (
          <Text variant="callout" tone="accent" weight="600" onPress={link.onPress} suppressHighlighting accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
            {link.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }} aria-checked={value}
      accessibilityLabel={label}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', minHeight: 44 },
  // A single-line label sits centred in its 44-pt target instead of leaving a gap below it.
  checkSingle: { alignItems: 'center' },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 3, borderWidth: 1, borderColor: colors.border },
  trackOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  thumbOn: { transform: [{ translateX: 20 }], backgroundColor: colors.action },
});
