import { toFrenchError } from '@jefeli/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';

import { AuthMethodSwitch, type AuthMethod } from '@/components/auth/AuthMethodSwitch';
import { useCaptcha } from '@/components/auth/Captcha';
import { PhoneOtpForm } from '@/components/auth/PhoneOtpForm';
import { Button, Checkbox, Field, Header, Screen, spacing, Text } from '@/design';
import { env } from '@/lib/env';
import { useFlag } from '@/lib/flags';
import { confirmEmailRedirectUrl } from '@/lib/recovery';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const params = useLocalSearchParams<{ method?: string; phone?: string }>();
  const phoneAuth = useFlag('phone_auth');
  const [method, setMethod] = useState<AuthMethod>(params.method === 'phone' ? 'phone' : 'email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const captcha = useCaptcha();
  const showPhone = phoneAuth && method === 'phone';

  const consents = name.trim().length >= 2 && adult && terms;
  const valid = consents && /\S+@\S+\.\S+/.test(email) && password.length >= 8 && (!captcha.required || !!captcha.token);

  async function submit() {
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: confirmEmailRedirectUrl(),
        ...(captcha.token ? { captchaToken: captcha.token } : {}),
      },
    });
    setLoading(false);
    captcha.reset();
    if (err) return setError(toFrenchError(err));
    if (!data.session) setCheckEmail(true); // e-mail confirmation enabled on this project
  }

  if (checkEmail) {
    return (
      <Screen edges={['top', 'bottom']} style={{ padding: spacing.xl, justifyContent: 'center', gap: spacing.md }}>
        <Text variant="title">Vérifiez votre e-mail</Text>
        <Text tone="secondary">
          Nous avons envoyé un lien de confirmation à {email}. Ouvrez-le sur ce téléphone pour activer votre compte.
        </Text>
        <Button label="J’ai confirmé, me connecter" variant="cta" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const consentBoxes = (
    <>
      <Checkbox checked={adult} onToggle={() => setAdult((v) => !v)} label="J’ai 18 ans ou plus." />
      <Checkbox
        checked={terms}
        onToggle={() => setTerms((v) => !v)}
        label="J’accepte les conditions d’utilisation et les règles de la communauté."
        link={{ label: 'Lire les conditions', onPress: () => Linking.openURL(`${env.webBaseUrl}/legal/cgu`) }}
      />
    </>
  );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Créer un compte" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Votre nom" value={name} onChangeText={setName} placeholder="Ex. Awa Ndiaye" autoComplete="name" maxLength={50} />
        {phoneAuth ? <AuthMethodSwitch value={method} onChange={setMethod} /> : null}
        {showPhone ? (
          <PhoneOtpForm
            purpose="sign_up"
            canSend={consents}
            displayName={name.trim()}
            initialPhone={params.phone}
            beforeSend={consentBoxes}
          />
        ) : (
          <>
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              hint="Votre e-mail reste privé : il n’apparaît jamais sur votre profil."
            />
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              error={password.length > 0 && password.length < 8 ? '8 caractères minimum' : null}
            />
            {consentBoxes}
            {captcha.element}
            {error ? (
              <Text tone="danger" variant="callout" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button label="Créer mon compte" variant="cta" size="lg" disabled={!valid} loading={loading} onPress={submit} />
          </>
        )}
        <Text variant="caption" tone="secondary" align="center">
          Jëfëli est réservé aux personnes majeures pendant la phase pilote.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
});
