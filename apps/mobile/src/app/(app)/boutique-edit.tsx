import { toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { fetchBoutique, updateBoutique } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/nav';

export default function BoutiqueEdit() {
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['boutique', userId], queryFn: () => fetchBoutique(userId ?? '') });
  if (q.isPending) return <Screen><Header title="Ma boutique" /></Screen>;
  if (!q.data) return <NoBoutique />;
  return <BoutiqueForm key={q.data.updated_at} initial={q.data} />;
}

function NoBoutique() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Ma boutique" />
      <Text tone="secondary" style={{ padding: spacing.lg }}>
        Votre boutique sera créée automatiquement avec votre premier article.
      </Text>
      <Button label="Ajouter un article" variant="cta" onPress={() => router.replace('/publish/listing')} style={{ margin: spacing.lg }} />
    </Screen>
  );
}

function BoutiqueForm({ initial }: { initial: { description: string; pickup_notes: string; delivery_notes: string; payment_notes: string } }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    description: initial.description,
    pickup_notes: initial.pickup_notes,
    delivery_notes: initial.delivery_notes,
    payment_notes: initial.payment_notes,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateBoutique(userId ?? '', form);
      qc.invalidateQueries({ queryKey: ['boutique', userId] });
      toast('Boutique mise à jour', 'success');
      goBack();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Ma boutique" right={<Button label="Enregistrer" size="sm" variant="cta" loading={saving} onPress={save} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text variant="callout" tone="secondary">
          Quelques informations pratiques pour vos clients. Pas de thème, pas d’abonnement : votre boutique reste votre profil.
        </Text>
        <Field label="Présentation" value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} multiline maxLength={500} counter placeholder="Ce que vous vendez, vos horaires…" />
        <Field label="Retrait" value={form.pickup_notes} onChangeText={(t) => setForm((f) => ({ ...f, pickup_notes: t }))} maxLength={300} placeholder="Ex. Marché HLM, cantine 42, du lundi au samedi" />
        <Field label="Livraison" value={form.delivery_notes} onChangeText={(t) => setForm((f) => ({ ...f, delivery_notes: t }))} maxLength={300} placeholder="Ex. Dakar 1 000 à 2 000 F selon le quartier" />
        <Field
          label="Paiement"
          value={form.payment_notes}
          onChangeText={(t) => setForm((f) => ({ ...f, payment_notes: t }))}
          maxLength={300}
          placeholder="Ex. Espèces à la remise, Wave, Orange Money"
          hint="Le paiement se fait directement entre vous et le client. Jëfëli n’encaisse rien et ne garantit pas les paiements."
        />
      </ScrollView>
    </Screen>
  );
}
