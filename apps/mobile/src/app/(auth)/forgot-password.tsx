import { toFrenchError } from '@jefeli/shared';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { useCaptcha } from '@/components/auth/Captcha';
import { Button, Field, Header, Screen, spacing, Text } from '@/design';
import { resetPasswordRedirectUrl } from '@/lib/recovery';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const captcha = useCaptcha();

  async function submit() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: resetPasswordRedirectUrl(),
      ...(captcha.token ? { captchaToken: captcha.token } : {}),
    });
    setLoading(false);
    captcha.reset();
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
            {captcha.element}
            {error ? <Text tone="danger">{error}</Text> : null}
            <Button label="Envoyer le lien" variant="cta" loading={loading} disabled={!email || (captcha.required && !captcha.token)} onPress={submit} />
            <Text variant="caption" tone="secondary">
              Compte créé avec votre numéro ? Pas de mot de passe : connectez-vous avec un code reçu par SMS.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
