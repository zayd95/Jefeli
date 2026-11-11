import { Mail, Smartphone } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, Text } from '@/design';

export type AuthMethod = 'email' | 'phone';

const OPTIONS: { key: AuthMethod; label: string; icon: typeof Mail }[] = [
  { key: 'email', label: 'E-mail', icon: Mail },
  { key: 'phone', label: 'Téléphone', icon: Smartphone },
];

/** « E-mail | Téléphone »: two equal ways in, same place on sign-up and sign-in. */
export function AuthMethodSwitch({ value, onChange }: { value: AuthMethod; onChange: (next: AuthMethod) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel="Méthode de connexion">
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            testID={`auth-method-${key}`}
          >
            <Icon size={17} color={on ? colors.white : colors.ink} strokeWidth={2.2} />
            <Text variant="callout" weight="700" color={on ? colors.white : colors.ink}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle },
  item: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  itemOn: { backgroundColor: colors.ink },
});
