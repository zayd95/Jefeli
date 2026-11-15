import { PHONE_COUNTRIES, type PhoneCountry } from '@jefeli/shared';
import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, Field, radius, Sheet, spacing, Text } from '@/design';

/**
 * Country + national number. Only countries whose SMS delivery has been verified are listed
 * (Sénégal to start); the sheet says so, and the list grows without changing this screen.
 */
export function PhoneField({
  country,
  onCountry,
  value,
  onChangeText,
  error,
  hint,
  editable = true,
  onSubmitEditing,
}: {
  country: PhoneCountry;
  onCountry: (c: PhoneCountry) => void;
  value: string;
  onChangeText: (t: string) => void;
  error?: string | null;
  hint?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="callout" weight="600">
        Numéro de mobile
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => setPicking(true)}
          disabled={!editable}
          style={({ pressed }) => [styles.country, pressed && { backgroundColor: colors.surfaceSubtle }]}
          accessibilityRole="button"
          accessibilityLabel={`Pays : ${country.name}, indicatif +${country.dial}. Changer`}
          testID="phone-country"
        >
          <Text variant="bodyStrong">{country.flag}</Text>
          <Text variant="bodyStrong">+{country.dial}</Text>
          <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Field
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            placeholder={country.example}
            accessibilityLabel={`Numéro de mobile, sans l’indicatif +${country.dial}`}
            maxLength={20}
            returnKeyType="send"
            onSubmitEditing={onSubmitEditing}
            testID="phone-input"
          />
        </View>
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

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Pays">
        {PHONE_COUNTRIES.map((c) => {
          const on = c.code === country.code;
          return (
            <Pressable
              key={c.code}
              onPress={() => {
                onCountry(c);
                setPicking(false);
              }}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
            >
              <Text variant="bodyStrong">{c.flag}</Text>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Text tone="secondary">+{c.dial}</Text>
              {on ? <Check size={18} color={colors.accentDeep} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
          D’autres pays seront ajoutés dès que l’envoi des SMS y aura été vérifié.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  country: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
});
