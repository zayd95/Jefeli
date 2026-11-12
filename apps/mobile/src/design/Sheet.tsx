import type { LucideIcon } from 'lucide-react-native';
import { createContext, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, dark, radius, spacing } from './theme';
import { fill } from './fill';

const SheetTone = createContext<'light' | 'dark'>('light');

/**
 * Bottom sheet with Lovable's shape (28-pt top corners, grabber, night backdrop). `tone="dark"`
 * is the `.lab-glass` action sheet (fog text on Atlantic night) used for menus and pickers made
 * of SheetActions; content-heavy sheets (reviews, product picker, offers) stay light for reading.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll,
  tone = 'light',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  tone?: 'light' | 'dark';
}) {
  const insets = useSafeAreaInsets();
  const isDark = tone === 'dark';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SheetTone.Provider value={tone}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
          <View style={[styles.sheet, isDark && styles.sheetDark, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
            <View style={[styles.grabber, isDark && { backgroundColor: dark.borderStrong }]} />
            {title ? (
              <Text variant="headline" weight="800" tone={isDark ? 'fog' : 'default'} style={{ marginBottom: spacing.md }} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {scroll ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>{children}</ScrollView> : children}
          </View>
        </KeyboardAvoidingView>
      </SheetTone.Provider>
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
  const isDark = useContext(SheetTone) === 'dark';
  const color = destructive ? (isDark ? dark.danger : colors.danger) : isDark ? dark.text : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: isDark ? dark.subtle : colors.surfaceSubtle }]}
    >
      <View style={[styles.actionIcon, isDark && { backgroundColor: dark.subtle }, destructive && { backgroundColor: isDark ? dark.subtle : colors.dangerSoft }]}>
        <Icon size={20} color={destructive ? color : isDark ? dark.mint : color} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={color}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone={isDark ? 'fogSecondary' : 'secondary'}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...fill, backgroundColor: dark.scrimSoft },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetDark: { backgroundColor: dark.surface, borderWidth: 1, borderBottomWidth: 0, borderColor: dark.glassBorder },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md, minHeight: 52 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
});
