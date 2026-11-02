import { toFrenchError } from '@jefeli/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';

import { Button, Checkbox, Field, Header, Screen, spacing, Text } from '@/design';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const valid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8 && adult && terms;

  async function submit() {
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: 'jefeli://' },
    });
    setLoading(false);
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

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Créer un compte" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Votre nom" value={name} onChangeText={setName} placeholder="Ex. Awa Ndiaye" autoComplete="name" maxLength={50} />
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
        <Checkbox checked={adult} onToggle={() => setAdult((v) => !v)} label="J’ai 18 ans ou plus." />
        <Checkbox
          checked={terms}
          onToggle={() => setTerms((v) => !v)}
          label="J’accepte les conditions d’utilisation et les règles de la communauté."
          link={{ label: 'Lire les conditions', onPress: () => Linking.openURL(`${env.webBaseUrl}/legal/cgu`) }}
        />
        {error ? (
          <Text tone="danger" variant="callout" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label="Créer mon compte" variant="cta" size="lg" disabled={!valid} loading={loading} onPress={submit} />
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
