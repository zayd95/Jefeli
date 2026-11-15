import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { OptionRow } from '@/components/Composer';
import { Button, Card, colors, Field, Header, Screen, spacing, Tag, Text, useToast } from '@/design';
import { myVerificationRequests, requestVerification } from '@/lib/api/safety';
import { useAuth } from '@/lib/auth';

type BusinessType = 'boutique' | 'marche' | 'artisan' | 'entreprise' | 'autre';

export default function Verification() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['verification-requests', userId], queryFn: () => myVerificationRequests(userId ?? '') });
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>('boutique');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = (q.data ?? []).find((r) => r.status === 'pending');
  const verified = profile?.verification_level === 'merchant_verified';

  async function submit() {
    setBusy(true);
    try {
      await requestVerification(userId ?? '', { business_name: name.trim(), business_type: type, details: details.trim() });
      qc.invalidateQueries({ queryKey: ['verification-requests', userId] });
      toast('Demande envoyée', 'success');
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Vérification vendeur" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BadgeCheck size={22} color={colors.white} fill={colors.accentDeep} />
            <Text variant="headline">Ce que signifie le badge</Text>
          </View>
          <Text variant="callout" tone="secondary">
            Le badge « Vendeur vérifié » indique que l’équipe Jëfëli a examiné les informations de votre activité. Il ne garantit ni la qualité des produits ni les transactions, et peut être retiré en cas d’abus. Il n’est jamais attribué automatiquement.
          </Text>
        </Card>

        {verified ? (
          <Tag label="Vous êtes vendeur vérifié" tone="mint" />
        ) : pending ? (
          <Card>
            <Text variant="bodyStrong">Demande en cours d’examen</Text>
            <Text variant="callout" tone="secondary">
              « {pending.business_name} » · envoyée {timeAgo(pending.created_at)}
            </Text>
          </Card>
        ) : (
          <>
            <Field label="Nom de l’activité" value={name} onChangeText={setName} maxLength={80} placeholder="Ex. Awa Couture" />
            <OptionRow<BusinessType>
              value={type}
              onChange={setType}
              options={[
                { key: 'boutique', label: 'Boutique' },
                { key: 'marche', label: 'Marché' },
                { key: 'artisan', label: 'Artisan' },
                { key: 'entreprise', label: 'Société' },
              ]}
            />
            <Field
              label="Informations utiles"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
              placeholder="Adresse de la boutique ou du marché, NINEA si vous en avez un, liens vers vos pages existantes…"
              hint="Ne partagez pas de pièce d’identité ici. L’équipe vous contactera si nécessaire."
            />
            <Button label="Envoyer la demande" variant="cta" disabled={name.trim().length < 2} loading={busy} onPress={submit} />
          </>
        )}

        {(q.data ?? []).filter((r) => r.status !== 'pending').map((r) => (
          <Text key={r.id} variant="caption" tone="secondary">
            Demande « {r.business_name} » {r.status === 'approved' ? 'acceptée' : 'refusée'} {r.reviewed_at ? timeAgo(r.reviewed_at) : ''}
            {r.review_note ? ` — ${r.review_note}` : ''}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}
