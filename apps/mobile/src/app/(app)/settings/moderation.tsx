import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, Field, Header, Screen, Sheet, spacing, Tag, Text, useToast } from '@/design';
import { myAppeals, myModerationActions, myReports, submitAppeal } from '@/lib/api/safety';
import { useAuth } from '@/lib/auth';

const ACTION_LABELS: Record<string, string> = {
  hide_content: 'Contenu masqué',
  remove_content: 'Contenu retiré',
  restore_content: 'Contenu rétabli',
  suspend_user: 'Compte suspendu',
  unsuspend_user: 'Suspension levée',
  warn_user: 'Avertissement',
  grant_verification: 'Badge vendeur vérifié attribué',
  revoke_verification: 'Badge vendeur vérifié retiré',
  reverse_on_appeal: 'Décision annulée après contestation',
};
const APPEALABLE = new Set(['hide_content', 'remove_content', 'suspend_user', 'warn_user', 'revoke_verification']);
const REPORT_STATUS: Record<string, string> = { open: 'En attente', in_review: 'En cours d’examen', actioned: 'Mesure prise', dismissed: 'Classé sans suite' };

export default function ModerationCenter() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const actions = useQuery({ queryKey: ['my-moderation', userId], queryFn: () => myModerationActions(userId ?? '') });
  const appeals = useQuery({ queryKey: ['my-appeals', userId], queryFn: () => myAppeals(userId ?? '') });
  const reports = useQuery({ queryKey: ['my-reports', userId], queryFn: () => myReports(userId ?? '') });
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const appealed = new Map((appeals.data ?? []).map((a) => [a.moderation_action_id, a]));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Modération" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text variant="headline">Décisions concernant mes contenus</Text>
        {(actions.data ?? []).length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="Aucune décision" body="Vous serez notifié(e) si l’équipe prend une mesure sur vos contenus." />
        ) : (
          (actions.data ?? []).map((a) => {
            const ap = appealed.get(a.id);
            return (
              <Card key={a.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">{ACTION_LABELS[a.action] ?? a.action}</Text>
                  <Text variant="caption" tone="secondary">
                    {timeAgo(a.created_at)}
                  </Text>
                </View>
                {a.reason ? <Text variant="callout" tone="secondary">Motif : {a.reason}</Text> : null}
                {ap ? (
                  <Tag label={ap.status === 'open' ? 'Contestation en cours' : ap.status === 'reversed' ? 'Contestation acceptée' : 'Décision maintenue'} tone={ap.status === 'reversed' ? 'mint' : 'neutral'} />
                ) : APPEALABLE.has(a.action) ? (
                  <Button label="Contester cette décision" variant="outline" size="sm" onPress={() => setAppealFor(a.id)} />
                ) : null}
              </Card>
            );
          })
        )}

        <Text variant="headline" style={{ marginTop: spacing.md }}>
          Mes signalements
        </Text>
        {(reports.data ?? []).length === 0 ? (
          <Text tone="secondary">Aucun signalement envoyé.</Text>
        ) : (
          (reports.data ?? []).map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text variant="callout">
                {r.target_type} · {timeAgo(r.created_at)}
              </Text>
              <Tag label={REPORT_STATUS[r.status] ?? r.status} />
            </View>
          ))
        )}
      </ScrollView>
      <Sheet visible={!!appealFor} onClose={() => setAppealFor(null)} title="Contester la décision">
        <View style={{ gap: spacing.md }}>
          <Text variant="callout" tone="secondary">
            Expliquez pourquoi la décision vous semble injuste. Une autre personne de l’équipe l’examinera.
          </Text>
          <Field value={body} onChangeText={setBody} multiline maxLength={1000} placeholder="10 caractères minimum" />
          <Button
            label="Envoyer"
            variant="cta"
            disabled={body.trim().length < 10}
            onPress={async () => {
              const id = appealFor as string;
              setAppealFor(null);
              try {
                await submitAppeal(id, body.trim());
                setBody('');
                qc.invalidateQueries({ queryKey: ['my-appeals', userId] });
                toast('Contestation envoyée', 'success');
              } catch (e) {
                toast(toFrenchError(e), 'error');
              }
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
