import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CircleDot, ImageIcon, Radio, ShoppingBag, X, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, IconButton, radius, Screen, spacing, Text } from '@/design';
import { liveFunction, type LiveProviderStatus } from '@/lib/api/live';
import { useFlag } from '@/lib/flags';
import { goBack } from '@/lib/nav';

export default function PublishChooser() {
  const liveFlag = useFlag('live_streaming');
  const provider = useQuery({
    queryKey: ['live-provider-status'],
    queryFn: () => liveFunction<LiveProviderStatus>('status'),
    retry: 0,
    staleTime: 60_000,
  });
  const liveReady = liveFlag && provider.data?.configured === true;

  const options: { icon: LucideIcon; title: string; body: string; href: string; disabled?: boolean }[] = [
    { icon: ImageIcon, title: 'Publication', body: 'Photo, vidéo ou texte. Identifiez vos articles si vous le souhaitez.', href: '/publish/post' },
    { icon: CircleDot, title: 'Statut', body: 'Visible 24 h par vos abonnés ou vos amis. Idéal pour un arrivage.', href: '/publish/status' },
    { icon: ShoppingBag, title: 'Article', body: 'Neuf ou d’occasion, à vendre ou à échanger. Ajouté à votre boutique.', href: '/publish/listing' },
    {
      icon: Radio,
      title: 'Live',
      body: liveReady
        ? 'Passez en direct, présentez vos articles et répondez aux questions.'
        : 'Bientôt disponible : le direct nécessite l’activation d’un fournisseur vidéo par l’équipe Jëfëli.',
      href: '/live/host',
      disabled: !liveReady,
    },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Publier</Text>
        <IconButton icon={X} label="Fermer" onPress={() => goBack()} />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {options.map(({ icon: Icon, title, body, href, disabled }) => (
          <Pressable
            key={title}
            disabled={disabled}
            onPress={() => router.replace(href as never)}
            style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceSubtle }, disabled && { opacity: 0.55 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            accessibilityLabel={`${title}. ${body}`}
          >
            <View style={[styles.icon, title === 'Live' && !disabled && { backgroundColor: colors.dangerSoft }]}>
              <Icon size={24} color={title === 'Live' && !disabled ? colors.live : colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{title}</Text>
              <Text variant="callout" tone="secondary">
                {body}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.sm },
  option: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
});
