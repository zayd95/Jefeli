/**
 * Sign-in methods of the account: add or change a verified mobile number. The number is
 * attached to THIS account (Supabase `phone_change`): same profile, boutique and articles.
 * A number already used by another account is refused, never merged.
 */
import { formatPhone } from '@jefeli/shared';
import { Mail, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PhoneOtpForm } from '@/components/auth/PhoneOtpForm';
import { Button, Card, colors, Header, Screen, spacing, Text, useToast } from '@/design';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/flags';

export default function PhoneSettings() {
  const { session } = useAuth();
  const phoneAuth = useFlag('phone_auth');
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const email = session?.user.email || null;
  const phone = session?.user.phone ? formatPhone(session.user.phone) : null;

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Connexion" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.md }}>
          <Text variant="headline">Vos moyens de connexion</Text>
          <Row icon={Mail} label="E-mail" value={email ?? 'Aucun e-mail'} />
          <Row icon={Smartphone} label="Mobile" value={phone ?? 'Aucun numéro'} testID="settings-phone-value" />
          <Text variant="caption" tone="secondary">
            Privés : ils n’apparaissent jamais sur votre profil.
          </Text>
        </Card>

        {!phoneAuth ? (
          <Text tone="secondary">La connexion par SMS n’est pas encore ouverte sur Jëfëli.</Text>
        ) : editing ? (
          <Card style={{ gap: spacing.md }}>
            <Text variant="headline">{phone ? 'Changer de numéro' : 'Ajouter un numéro'}</Text>
            <PhoneOtpForm
              purpose="link"
              onVerified={() => {
                // verifyOtp('phone_change') already returned the updated session.
                setEditing(false);
                toast('Numéro vérifié : vous pouvez maintenant vous connecter avec lui.', 'success');
              }}
            />
            <Button label="Annuler" variant="ghost" onPress={() => setEditing(false)} />
          </Card>
        ) : (
          <Button
            label={phone ? 'Changer de numéro' : 'Ajouter un numéro de mobile'}
            variant="outline"
            icon={Smartphone}
            onPress={() => setEditing(true)}
            testID="settings-phone-edit"
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ icon: Icon, label, value, testID }: { icon: typeof Mail; label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Icon size={18} color={colors.textSecondary} strokeWidth={2.2} />
      <Text variant="callout" tone="secondary" style={{ width: 64 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1 }} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
