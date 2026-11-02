import { toFrenchError } from '@jefeli/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Header, Screen, spacing, Text } from '@/design';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) setError(toFrenchError(err));
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Se connecter" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="title">Bon retour sur Jëfëli</Text>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="vous@exemple.com"
        />
        <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        {error ? (
          <Text tone="danger" variant="callout" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label="Se connecter" variant="cta" size="lg" loading={loading} disabled={!email || !password} onPress={submit} />
        <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => router.push('/forgot-password')} />
      </ScrollView>
    </Screen>
  );
}
