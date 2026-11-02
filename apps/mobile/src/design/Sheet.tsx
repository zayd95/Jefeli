import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, radius, spacing } from './theme';
import { fill } from './fill';

export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {title ? (
            <Text variant="headline" weight="800" style={{ marginBottom: spacing.md }} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>{children}</ScrollView> : children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetAction({
  icon: Icon,
  label,
  onPress,
  destructive,
  description,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  description?: string;
}) {
  const color = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceSubtle }]}
    >
      <View style={[styles.actionIcon, destructive && { backgroundColor: colors.dangerSoft }]}>
        <Icon size={20} color={color} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={color}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...fill, backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md, minHeight: 52 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
});
