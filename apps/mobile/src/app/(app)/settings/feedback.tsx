/**
 * « Donner mon avis » (web beta, W1): an optional, short message to the Jëfëli team — a problem,
 * an idea, something unclear. Only staff can read it (see migration …20261108000100_feedback).
 */
import { toFrenchError } from '@jefeli/shared';
import { useState } from 'react';
import { Platform, ScrollView } from 'react-native';

import { ChoicePills } from '@/components/Composer';
import { Button, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { sendFeedback, type FeedbackKind } from '@/lib/api/feedback';
import { goBack } from '@/lib/nav';

const KINDS: { key: FeedbackKind; label: string }[] = [
  { key: 'problem', label: 'Un problème' },
  { key: 'idea', label: 'Une idée' },
  { key: 'unclear', label: 'Pas clair' },
  { key: 'other', label: 'Autre' },
];
const MAX = 1000;

export default function Feedback() {
  const toast = useToast();
  const [kind, setKind] = useState<FeedbackKind>('problem');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = message.trim().length >= 3;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await sendFeedback({ kind, message: message.trim(), platform: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android' });
      toast('Merci, votre avis est envoyé', 'success');
      goBack('/settings');
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Donner mon avis" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Text variant="callout" tone="secondary">
          Lu par l’équipe Jëfëli. Ne mettez ni mot de passe ni code reçu par SMS.
        </Text>
        <ChoicePills options={KINDS} value={kind} onChange={setKind} />
        <Field
          label="Votre message"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MAX}
          counter
          placeholder={kind === 'problem' ? 'Ce que vous faisiez, ce qui s’est passé…' : 'Dites-nous en quelques mots'}
        />
        <Button label="Envoyer" variant="cta" size="lg" disabled={!valid} loading={busy} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}
