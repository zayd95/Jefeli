import { toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Radio, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, colors, EmptyState, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { liveFunction, type LiveProviderStatus } from '@/lib/api/live';
import { isLiveSdkAvailable } from '@/lib/live';
import { goBack } from '@/lib/nav';

/**
 * Go Live: the server creates the session + provider call and returns a host token.
 * The session only shows "EN DIRECT" once the provider confirms the stream started.
 */
export default function HostLive() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const sdk = isLiveSdkAvailable();
  const status = useQuery({ queryKey: ['live-provider-status'], queryFn: () => liveFunction<LiveProviderStatus>('status'), retry: 0 });

  if (!status.data?.configured || !sdk) {
    const reason = !sdk
      ? 'Le direct fonctionne uniquement dans la version installable de Jëfëli (build de développement ou de production), pas dans Expo Go ni sur le web.'
      : status.data?.reason === 'feature_disabled'
        ? 'Le direct est désactivé par l’équipe Jëfëli pendant cette phase du pilote.'
        : 'Le fournisseur vidéo n’est pas encore configuré. Aucune diffusion n’est simulée.';
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Passer en direct" />
        <EmptyState icon={Radio} title="Direct indisponible" body={reason} actionLabel="Retour" onAction={() => goBack()} />
      </Screen>
    );
  }

  async function start() {
    setBusy(true);
    try {
      const res = await liveFunction<{ session: { id: string } }>('create', { title: title.trim() });
      router.replace(`/live/${res.session.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast(msg === 'live_already_active' ? 'Vous avez déjà un live en cours.' : toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Passer en direct" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Field label="Titre du live" value={title} onChangeText={setTitle} maxLength={80} placeholder="Ex. Arrivage de wax · nouvelles couleurs" />
        <Card style={{ flexDirection: 'row', gap: spacing.md }}>
          <ShieldAlert size={20} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="700">
              Avant de commencer
            </Text>
            <Text variant="caption" tone="secondary">
              Vos abonnés seront notifiés quand le direct démarre réellement. Vous pourrez épingler vos articles, masquer des commentaires et rendre un spectateur muet. Les règles de la communauté s’appliquent.
            </Text>
          </View>
        </Card>
        <Button label="Préparer le live" variant="cta" size="lg" icon={Radio} disabled={title.trim().length < 3} loading={busy} onPress={start} />
      </ScrollView>
    </Screen>
  );
}
