import { router } from 'expo-router';
import { MessageCircle, Search, Smartphone, Store } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button, colors, Screen, spacing, Text, Wordmark } from '@/design';
import { env, isProduction } from '@/lib/env';
import { useFlag } from '@/lib/flags';

const POINTS = [
  { icon: Search, title: 'Découvre', body: 'Les boutiques et les bonnes affaires près de chez toi, à Dakar et ailleurs.' },
  { icon: Store, title: 'Partage', body: 'Publications, statuts et lives : ta boutique fait partie de ton profil.' },
  { icon: MessageCircle, title: 'Vends', body: 'Discute, négocie ou propose un troc directement en message privé.' },
];

export default function Welcome() {
  const phoneAuth = useFlag('phone_auth');
  return (
    <Screen edges={['top', 'bottom']} style={styles.wrap}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Wordmark size={52} />
        <Text variant="headline" tone="secondary" weight="500" style={{ marginTop: spacing.sm }}>
          Découvre. Partage. Vends.
        </Text>
        <Text variant="title" style={{ marginTop: spacing.xxl, maxWidth: 320 }}>
          Le réseau social du commerce sénégalais
        </Text>
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          {POINTS.map(({ icon: Icon, title, body }) => (
            <View key={title} style={styles.point}>
              <View style={styles.pointIcon}>
                <Icon size={20} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{title}</Text>
                <Text variant="callout" tone="secondary">
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button label="Créer un compte" variant="cta" size="lg" onPress={() => router.push('/sign-up')} />
        <Button label="J’ai déjà un compte" variant="outline" size="lg" onPress={() => router.push('/sign-in')} />
        {phoneAuth ? (
          <Button label="Continuer avec mon numéro (+221)" variant="ghost" onPress={() => router.push('/phone')} />
        ) : (
          // Visibly gated: SMS needs a configured (paid) provider. Email stays the way in.
          <View style={styles.smsGate} accessible accessibilityRole="text" accessibilityLabel="Connexion par SMS, numéros +221 : bientôt disponible. Utilisez l’e-mail pour le moment." aria-disabled>
            <Smartphone size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              Connexion par SMS (+221) : bientôt. Utilisez l’e-mail pour le moment.
            </Text>
          </View>
        )}
        {!isProduction ? (
          <Text variant="caption" tone="secondary" align="center" style={{ marginTop: spacing.sm }}>
            Version pilote · environnement {env.appEnv === 'staging' ? 'de recette' : 'de test'}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  smsGate: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  wrap: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
