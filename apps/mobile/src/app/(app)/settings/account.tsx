import { toFrenchError } from '@jefeli/shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, ScrollView } from 'react-native';

import { confirmAsync } from '@/components/ContentMenu';
import { Button, Card, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { deleteMyAccount, exportMyData } from '@/lib/api/safety';
import { useAuth } from '@/lib/auth';

export default function AccountData() {
  const { signOut, profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');

  async function doExport() {
    setBusy('export');
    try {
      const data = await exportMyData();
      const json = JSON.stringify(data, null, 2);
      const name = `jefeli-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, name);
        file.create({ overwrite: true });
        file.write(json);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Mes données Jëfëli' });
      }
      toast('Export prêt', 'success');
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!(await confirmAsync('Supprimer définitivement votre compte ?', 'Profil, boutique, publications, statuts, messages envoyés et fichiers seront supprimés. Cette action est irréversible.', 'Supprimer'))) return;
    setBusy('delete');
    try {
      await deleteMyAccount();
      toast('Compte supprimé', 'success');
      await signOut();
    } catch (e) {
      toast(e instanceof Error && e.message.startsWith('http_') ? 'La suppression n’a pas pu aboutir. Réessayez ou contactez l’équipe.' : toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Mes données" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Card style={{ gap: spacing.md }}>
          <Text variant="headline">Télécharger mes données</Text>
          <Text variant="callout" tone="secondary">
            Un fichier JSON avec votre compte, profil, publications, articles, statuts, messages envoyés, propositions, accords, avis et signalements.
          </Text>
          <Button label="Exporter mes données" variant="outline" icon={Download} loading={busy === 'export'} onPress={doExport} />
        </Card>
        <Card style={{ gap: spacing.md }}>
          <Text variant="headline">Supprimer mon compte</Text>
          <Text variant="callout" tone="secondary">
            La suppression est immédiate et définitive. Les conversations seront retirées pour vous et vos interlocuteurs. Pensez à exporter vos données avant.
          </Text>
          <Field label={`Tapez « ${profile?.handle ?? ''} » pour confirmer`} value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
          <Button label="Supprimer mon compte" variant="danger" icon={Trash2} disabled={confirm.trim() !== profile?.handle} loading={busy === 'delete'} onPress={doDelete} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
