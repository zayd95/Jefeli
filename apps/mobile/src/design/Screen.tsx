import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { colors, spacing } from './theme';

export function Screen({
  children,
  edges = ['top'],
  style,
  keyboard,
  background = colors.background,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  background?: string;
}) {
  const inner = <View style={[{ flex: 1 }, style]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: background }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Header({
  title,
  right,
  onBack,
  back = true,
  subtitle,
  left,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  onBack?: () => void;
  back?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {left ??
          (back ? (
            <IconButton
              icon={ChevronLeft}
              label="Retour"
              size={26}
              onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            />
          ) : null)}
      </View>
      <View style={styles.center}>
        {title ? (
          <Text variant="headline" weight="700" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  side: { minWidth: 88, flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center' },
});
