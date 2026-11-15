/**
 * Lovable publishing chrome: « ← Publier » header (serif) and the compact
 * Publication · Article · Statut switcher. The dock's Plus opens the Publication composer
 * directly; the two other modes sit right next to it, never behind a separate hub.
 * Each mode keeps its own route, draft and server rules (create_post / create_listing / stories).
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, Text } from '@/design';
import { goBack } from '@/lib/nav';

export type PublishMode = 'post' | 'listing' | 'status';

const MODES: { key: PublishMode; label: string; href: '/publish/post' | '/publish/listing' | '/publish/status' }[] = [
  { key: 'post', label: 'Publication', href: '/publish/post' },
  { key: 'listing', label: 'Article', href: '/publish/listing' },
  { key: 'status', label: 'Statut', href: '/publish/status' },
];

export function PublishHeader({ mode, right }: { mode: PublishMode; right?: ReactNode }) {
  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={4}>
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text serif weight="600" accessibilityRole="header" style={styles.title}>
          Publier
        </Text>
        {right}
      </View>
      <View style={styles.switcher} accessibilityRole="tablist" aria-label="Type de publication">
        {MODES.map((m) => {
          const on = m.key === mode;
          return (
            <Pressable
              key={m.key}
              onPress={() => (on ? undefined : router.replace(m.href))}
              style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && !on && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              accessibilityLabel={m.label}
            >
              <Text weight="700" color={on ? colors.onPrimary : colors.textSecondary} style={{ fontSize: 13 }}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingRight: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 26, lineHeight: 32, color: colors.ink },
  switcher: { flexDirection: 'row', gap: 4, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  mode: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.primary },
});
