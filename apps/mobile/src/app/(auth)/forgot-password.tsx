import { toFrenchError } from '@jefeli/shared';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Header, Screen, spacing, Text } from '@/design';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: 'jefeli://reset-password' });
    setLoading(false);
    if (err) setError(toFrenchError(err));
    else setSent(true);
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Mot de passe oublié" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {sent ? (
          <Text>
            Si un compte existe pour {email}, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe.
          </Text>
        ) : (
          <>
            <Text tone="secondary">Indiquez l’e-mail de votre compte. Nous vous enverrons un lien de réinitialisation.</Text>
            <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            {error ? <Text tone="danger">{error}</Text> : null}
            <Button label="Envoyer le lien" variant="cta" loading={loading} disabled={!email} onPress={submit} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
