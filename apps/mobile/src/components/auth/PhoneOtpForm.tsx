import { formatPhone, phoneProblem } from '@jefeli/shared';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field, spacing, Text } from '@/design';
import { type PhonePurpose, usePhoneOtp } from '@/lib/phoneOtp';

import { useCaptcha } from './Captcha';
import { PhoneField } from './PhoneField';

const SEND_LABEL: Record<PhonePurpose, string> = {
  sign_in: 'Recevoir le code par SMS',
  sign_up: 'Recevoir le code par SMS',
  link: 'Envoyer le code à ce numéro',
};

const VERIFY_LABEL: Record<PhonePurpose, string> = {
  sign_in: 'Se connecter',
  sign_up: 'Créer mon compte',
  link: 'Vérifier le numéro',
};

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Number → 6-digit code, shared by « Se connecter », « Créer un compte » and the account
 * settings. `beforeSend` sits between the number and the button (sign-up consents).
 */
export function PhoneOtpForm({
  purpose,
  canSend = true,
  displayName,
  initialPhone,
  beforeSend,
  onNoAccount,
  onVerified,
}: {
  purpose: PhonePurpose;
  canSend?: boolean;
  displayName?: string;
  initialPhone?: string;
  beforeSend?: ReactNode;
  onNoAccount?: (e164: string) => void;
  onVerified?: () => void;
}) {
  const otp = usePhoneOtp(purpose, { initialPhone, onVerified });
  const captcha = useCaptcha();
  const problem = phoneProblem(otp.parsed, otp.country);
  const captchaMissing = purpose !== 'link' && captcha.required && !captcha.token;

  async function send() {
    const ok = await otp.send({ displayName, captchaToken: captcha.token });
    if (purpose !== 'link') captcha.reset();
    return ok;
  }

  const ready = otp.parsed.ok && canSend && !captchaMissing;
  const content =
    otp.step === 'number' ? (
      <View style={styles.wrap} key="number">
        <PhoneField
          country={otp.country}
          onCountry={otp.setCountry}
          value={otp.input}
          onChangeText={otp.setInput}
          error={problem}
          hint="Un SMS avec un code à 6 chiffres. Votre numéro reste privé."
          onSubmitEditing={() => ready && void send()}
        />
        {beforeSend}
        {otp.error ? (
          <ErrorLine message={otp.error.kind === 'no_account' && onNoAccount ? 'Aucun compte n’utilise encore ce numéro.' : otp.error.message} />
        ) : null}
        {otp.error?.kind === 'no_account' && otp.parsed.ok && onNoAccount ? (
          <Button
            label="Créer un compte avec ce numéro"
            variant="outline"
            onPress={() => otp.parsed.ok && onNoAccount(otp.parsed.e164)}
            testID="phone-create-instead"
          />
        ) : null}
        <Button label={SEND_LABEL[purpose]} variant="cta" size="lg" disabled={!ready} loading={otp.sending} onPress={() => void send()} testID="phone-send" />
      </View>
    ) : (
      <View style={styles.wrap} key="code">
        <View style={{ gap: spacing.xs }}>
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">
            Code envoyé au {formatPhone(otp.sentTo ?? '')}
          </Text>
          <Button
            label="Changer de numéro"
            variant="ghost"
            size="sm"
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            onPress={otp.changeNumber}
            testID="otp-change-number"
          />
        </View>
        <Field
          label="Code reçu par SMS"
          value={otp.code}
          onChangeText={otp.changeCode}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          placeholder="123456"
          hint="Le code expire après quelques minutes."
          style={styles.code}
          testID="otp-input"
        />
        {otp.error ? <ErrorLine message={otp.error.message} /> : null}
        <Button
          label={VERIFY_LABEL[purpose]}
          variant="cta"
          size="lg"
          disabled={otp.code.length !== 6}
          loading={otp.verifying}
          onPress={() => void otp.verify()}
          testID="otp-verify"
        />
        {otp.secondsLeft > 0 ? (
          <Text variant="callout" tone="secondary" align="center" testID="otp-countdown">
            Renvoyer le code dans {clock(otp.secondsLeft)}
          </Text>
        ) : (
          <Button label="Renvoyer le code" variant="ghost" loading={otp.sending} disabled={captchaMissing} onPress={() => void send()} testID="otp-resend" />
        )}
      </View>
    );

  // The CAPTCHA stays mounted across both steps (its widget is rendered once).
  return (
    <View style={styles.wrap}>
      {content}
      {purpose !== 'link' && captcha.element ? <View key="captcha">{captcha.element}</View> : null}
    </View>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <Text tone="danger" variant="callout" accessibilityLiveRegion="polite" testID="phone-error">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  code: { fontSize: 22, letterSpacing: 6 },
});
