/**
 * « Publier » entry: four icon-led choices in a compact grid. A publication covers sharing,
 * asking, proposing and questions (optional intent inside the composer), so there is no separate
 * « demande » entry. Live stays disabled until the video provider integration is live.
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CircleDot, PenLine, Radio, ShoppingBag, X, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, IconButton, radius, Screen, spacing, Text } from '@/design';
import { liveFunction, type LiveProviderStatus } from '@/lib/api/live';
import { useFlag } from '@/lib/flags';
import { goBack } from '@/lib/nav';

type Choice = { icon: LucideIcon; title: string; body: string; href: string; disabled?: boolean; badge?: string };

export default function PublishChooser() {
  const liveFlag = useFlag('live_streaming');
  const provider = useQuery({
    queryKey: ['live-provider-status'],
    queryFn: () => liveFunction<LiveProviderStatus>('status'),
    retry: 0,
    staleTime: 60_000,
  });
  const liveReady = liveFlag && provider.data?.configured === true;

  const choices: Choice[] = [
    { icon: PenLine, title: 'Publication', body: 'Texte, photos ou vidéo, pour tout le monde.', href: '/publish/post' },
    { icon: CircleDot, title: 'Statut', body: 'Visible 24 h, puis il disparaît.', href: '/publish/status' },
    { icon: ShoppingBag, title: 'Article', body: 'À vendre ou à échanger, dans votre boutique.', href: '/publish/listing' },
    {
      icon: Radio,
      title: 'Live',
      body: liveReady ? 'Présentez vos articles en direct.' : 'Arrive avec l’activation du direct vidéo.',
      href: '/live/host',
      disabled: !liveReady,
      badge: liveReady ? undefined : 'Bientôt',
    },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Publier</Text>
        <IconButton icon={X} label="Fermer" onPress={() => goBack()} />
      </View>
      <View style={styles.grid}>
        {choices.map(({ icon: Icon, title, body, href, disabled, badge }) => (
          <Pressable
            key={title}
            disabled={disabled}
            onPress={() => router.replace(href as never)}
            style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfaceSubtle }, disabled && styles.tileDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            aria-disabled={!!disabled}
            accessibilityLabel={`${title}. ${body}`}
          >
            <View style={[styles.icon, disabled && { backgroundColor: colors.surfaceMuted }]}>
              <Icon size={24} color={disabled ? colors.textSecondary : colors.ink} strokeWidth={2} />
            </View>
            <View style={styles.titleRow}>
              <Text variant="headline" color={disabled ? colors.textSecondary : colors.ink}>
                {title}
              </Text>
              {badge ? (
                <View style={styles.badge}>
                  <Text variant="micro" weight="700" tone="secondary">
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" tone="secondary" numberOfLines={3}>
              {body}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 136,
    padding: spacing.lg,
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileDisabled: { backgroundColor: colors.background },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: colors.surfaceMuted },
});
