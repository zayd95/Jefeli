import { router } from 'expo-router';
import {
  BadgeCheck,
  Ban,
  Bookmark,
  ChevronRight,
  FileText,
  Handshake,
  LogOut,
  QrCode,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserCog,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, Header, Screen, spacing, Text } from '@/design';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';

function Row({ icon: Icon, label, onPress, destructive }: { icon: LucideIcon; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSubtle }]} accessibilityRole="button">
      <Icon size={20} color={destructive ? colors.danger : colors.ink} />
      <Text variant="body" style={{ flex: 1 }} color={destructive ? colors.danger : colors.ink}>
        {label}
      </Text>
      {!destructive ? <ChevronRight size={18} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text variant="micro" weight="800" tone="secondary" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs, letterSpacing: 0.8 }}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export default function Settings() {
  const { signOut, profile } = useAuth();
  return (
    <Screen>
      <Header title="Réglages" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <Section title="COMPTE">
          <Row icon={UserCog} label="Modifier le profil" onPress={() => router.push('/edit-profile')} />
          <Row icon={Store} label="Infos de ma boutique" onPress={() => router.push('/boutique-edit')} />
          <Row icon={BadgeCheck} label={profile?.verification_level === 'merchant_verified' ? 'Vendeur vérifié' : 'Demander la vérification vendeur'} onPress={() => router.push('/settings/verification')} />
          <Row icon={QrCode} label="Inviter et partager mon profil" onPress={() => router.push('/invite')} />
          <Row icon={UserPlus} label="Demandes d’ami" onPress={() => router.push('/friends')} />
        </Section>
        <Section title="ACTIVITÉ">
          <Row icon={Bookmark} label="Enregistrés et favoris" onPress={() => router.push('/saved')} />
          <Row icon={Handshake} label="Mes accords et échanges" onPress={() => router.push('/agreements')} />
        </Section>
        <Section title="CONFIDENTIALITÉ ET SÉCURITÉ">
          <Row icon={SlidersHorizontal} label="Confidentialité et notifications" onPress={() => router.push('/settings/privacy')} />
          <Row icon={Ban} label="Comptes bloqués" onPress={() => router.push('/settings/blocked')} />
          <Row icon={ShieldCheck} label="Modération et contestations" onPress={() => router.push('/settings/moderation')} />
          <Row icon={UserCog} label="Mes données et suppression du compte" onPress={() => router.push('/settings/account')} />
        </Section>
        <Section title="INFORMATIONS">
          <Row icon={FileText} label="Conditions d’utilisation" onPress={() => Linking.openURL(`${env.webBaseUrl}/legal/cgu`)} />
          <Row icon={Scale} label="Règles de la communauté" onPress={() => Linking.openURL(`${env.webBaseUrl}/legal/regles`)} />
          <Row icon={ShieldCheck} label="Politique de confidentialité" onPress={() => Linking.openURL(`${env.webBaseUrl}/legal/confidentialite`)} />
        </Section>
        <Section title="">
          <Row icon={LogOut} label="Se déconnecter" destructive onPress={signOut} />
        </Section>
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: spacing.xl }}>
          Jëfëli · version pilote 0.1 · {env.appEnv}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
});
