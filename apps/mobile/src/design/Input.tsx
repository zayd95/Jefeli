import { Search, X } from 'lucide-react-native';
import { forwardRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { Text } from './Text';
import { colors, fonts, radius, spacing } from './theme';

export interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  suffix?: string;
  counter?: boolean;
}

export const Field = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(function Field(
  { label, hint, error, suffix, counter, style, multiline, maxLength, value, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="callout" weight="600">
            {label}
          </Text>
          {counter && maxLength ? (
            <Text variant="caption" tone="tertiary">
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.box,
          multiline && { minHeight: 104, alignItems: 'flex-start', paddingVertical: 12 },
          focused && { borderColor: colors.ink },
          !!error && { borderColor: colors.danger },
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentDeep}
          multiline={multiline}
          maxLength={maxLength}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
          style={[styles.input, multiline && { textAlignVertical: 'top' }, style]}
        />
        {suffix ? (
          <Text variant="callout" weight="600" tone="secondary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Rechercher un produit, un vendeur…',
  onSubmit,
  autoFocus,
  onPress,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.search} pointerEvents={onPress ? 'none' : 'auto'}>
      <Search size={18} color={colors.textSecondary} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        selectionColor={colors.accentDeep}
        accessibilityLabel="Rechercher"
        style={styles.searchInput}
        editable={!onPress}
      />
      {value && onChangeText ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel="Rechercher un produit ou un vendeur">
        {content}
      </Pressable>
    );
  }
  return content;
}

// Chromium's `outline-style: auto` focus ring ignores outline-width, so the style itself is
// removed on web (react-native-web passes it through; the native types don't list 'none').
export const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as unknown as TextStyle;

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  box: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong, // visible field edge on the sand canvas (non-text contrast)
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // On web the box border already turns ink on focus; drop the browser's second focus ring inside it.
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, paddingVertical: 10, minHeight: 24, ...WEB_NO_OUTLINE },
  // Pill-shaped white search field on the sand canvas (owner's UI reference).
  search: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 8, ...WEB_NO_OUTLINE },
});
