import { toFrenchError } from '@jefeli/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AuthMethodSwitch, type AuthMethod } from '@/components/auth/AuthMethodSwitch';
import { useCaptcha } from '@/components/auth/Captcha';
import { PhoneOtpForm } from '@/components/auth/PhoneOtpForm';
import { Button, Field, Header, Screen, spacing, Text } from '@/design';
import { useFlag } from '@/lib/flags';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const params = useLocalSearchParams<{ method?: string }>();
  const phoneAuth = useFlag('phone_auth');
  const [method, setMethod] = useState<AuthMethod>(params.method === 'phone' ? 'phone' : 'email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const captcha = useCaptcha();
  const showPhone = phoneAuth && method === 'phone';

  async function submit() {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      ...(captcha.token ? { options: { captchaToken: captcha.token } } : {}),
    });
    setLoading(false);
    captcha.reset();
    if (err) setError(toFrenchError(err));
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Se connecter" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="title">Bon retour sur Jëfëli</Text>
        {phoneAuth ? <AuthMethodSwitch value={method} onChange={setMethod} /> : null}
        {showPhone ? (
          <PhoneOtpForm
            purpose="sign_in"
            onNoAccount={(e164) => router.replace({ pathname: '/sign-up', params: { method: 'phone', phone: e164 } })}
          />
        ) : (
          <>
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
            {captcha.element}
            {error ? (
              <Text tone="danger" variant="callout" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label="Se connecter"
              variant="cta"
              size="lg"
              loading={loading}
              disabled={!email || !password || (captcha.required && !captcha.token)}
              onPress={submit}
            />
            <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => router.push('/forgot-password')} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
