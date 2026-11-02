/**
 * Phone OTP sign-in (Supabase Auth). Production use requires an SMS provider configured
 * in Supabase (paid) — gated by the `phone_auth` feature flag. Local development can use
 * Supabase "test OTP" numbers (no SMS sent).
 */
import { toFrenchError } from '@jefeli/shared';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Header, Screen, spacing, Text } from '@/design';
import { useFlag } from '@/lib/flags';
import { supabase } from '@/lib/supabase';

function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 9) return `+221${digits}`; // local Senegalese mobile number
  if (digits.startsWith('221') && digits.length === 12) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export default function PhoneSignIn() {
  const enabled = useFlag('phone_auth');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const e164 = toE164(phone);

  async function sendCode() {
    if (!e164) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);
    if (err) setError(toFrenchError(err));
    else setStep('code');
  }

  async function verify() {
    if (!e164) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    setLoading(false);
    if (err) setError(toFrenchError(err));
  }

  if (!enabled) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Connexion par SMS" />
        <Text style={{ padding: spacing.xl }} tone="secondary">
          La connexion par SMS n’est pas encore activée : elle nécessite un fournisseur SMS configuré. Utilisez l’e-mail pour le moment.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Connexion par SMS" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {step === 'phone' ? (
          <>
            <Field
              label="Numéro de téléphone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="77 123 45 67"
              hint="Votre numéro reste privé. Un code à 6 chiffres vous sera envoyé."
            />
            <Button label="Recevoir un code" variant="cta" disabled={!e164} loading={loading} onPress={sendCode} />
          </>
        ) : (
          <>
            <Text tone="secondary">Code envoyé au {e164}.</Text>
            <Field label="Code reçu" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" />
            <Button label="Valider" variant="cta" disabled={code.trim().length < 6} loading={loading} onPress={verify} />
            <Button label="Changer de numéro" variant="ghost" onPress={() => setStep('phone')} />
          </>
        )}
        {error ? <Text tone="danger">{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
