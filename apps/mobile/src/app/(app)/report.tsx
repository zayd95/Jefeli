import { REPORT_REASONS, toFrenchError, type ReportReason } from '@jefeli/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, colors, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { reportContent, type ReportTarget } from '@/lib/api/safety';

const TARGET_LABELS: Partial<Record<ReportTarget, string>> = {
  profile: 'ce compte',
  post: 'cette publication',
  comment: 'ce commentaire',
  product: 'cet article',
  story: 'ce statut',
  message: 'ce message',
  live_session: 'ce live',
  live_comment: 'ce commentaire de live',
};

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: ReportTarget; id: string }>();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason || !type || !id) return;
    setBusy(true);
    try {
      await reportContent(type, id, reason, details.trim());
      setDone(true);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen edges={['top', 'bottom']} style={{ padding: spacing.xl, justifyContent: 'center', gap: spacing.lg }}>
        <CheckCircle2 size={44} color={colors.accentDeep} />
        <Text variant="title">Merci pour votre signalement</Text>
        <Text tone="secondary">
          L’équipe de modération va l’examiner. Vous serez notifié(e) de la décision. Si vous vous sentez en danger, bloquez ce compte et contactez les autorités.
        </Text>
        <Button label="Fermer" variant="cta" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Signaler" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}>
        <Text variant="headline">Pourquoi signalez-vous {TARGET_LABELS[type ?? 'post'] ?? 'ce contenu'} ?</Text>
        <Text variant="callout" tone="secondary">
          Votre signalement est confidentiel : la personne concernée ne saura pas qui l’a fait.
        </Text>
        <View>
          {REPORT_REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable key={r.key} onPress={() => setReason(r.key)} style={styles.option} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                {on ? <CheckCircle2 size={22} color={colors.ink} /> : <Circle size={22} color={colors.borderStrong} />}
                <Text variant="body" weight={on ? '600' : '400'}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Détails (facultatif)" value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder="Ce qui s’est passé, quand…" />
        <Button label="Envoyer le signalement" variant="cta" size="lg" disabled={!reason} loading={busy} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 50, borderBottomWidth: 1, borderColor: colors.border },
});
