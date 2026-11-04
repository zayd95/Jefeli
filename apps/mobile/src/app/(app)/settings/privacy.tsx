import { AUDIENCE_LABELS, toFrenchError, type Audience } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';

import { OptionRow } from '@/components/Composer';
import { colors, Header, Screen, Skeleton, spacing, Text, Toggle, useToast } from '@/design';
import { getSettings, updateSettings } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

export default function PrivacySettings() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['settings', userId], queryFn: () => getSettings(userId ?? '') });
  const s = q.data;

  async function patch(p: Parameters<typeof updateSettings>[1]) {
    qc.setQueryData(['settings', userId], { ...s, ...p });
    try {
      await updateSettings(userId ?? '', p);
    } catch (e) {
      toast(toFrenchError(e), 'error');
      qc.invalidateQueries({ queryKey: ['settings', userId] });
    }
  }

  if (!s) {
    return (
      <Screen>
        <Header title="Confidentialité" />
        <Skeleton height={200} style={{ margin: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Confidentialité" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">Qui voit mes statuts par défaut</Text>
          <OptionRow<Audience>
            value={s.default_status_audience as Audience}
            onChange={(v) => patch({ default_status_audience: v })}
            options={(['public', 'followers', 'friends'] as Audience[]).map((k) => ({ key: k, label: AUDIENCE_LABELS[k] }))}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">Qui peut m’écrire</Text>
          <OptionRow<'everyone' | 'following' | 'friends'>
            value={s.allow_messages_from as 'everyone' | 'following' | 'friends'}
            onChange={(v) => patch({ allow_messages_from: v })}
            options={[
              { key: 'everyone', label: 'Tout le monde' },
              { key: 'following', label: 'Ceux que je suis' },
              { key: 'friends', label: 'Mes amis' },
            ]}
          />
          <Text variant="caption" tone="secondary">
            Pour un vendeur, « Tout le monde » permet aux clients de vous contacter depuis vos articles.
          </Text>
        </View>
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg }}>
          <Text variant="headline">Notifications push</Text>
          <Toggle value={s.notify_push} onChange={(v) => patch({ notify_push: v })} label="Autoriser les notifications" />
          <Toggle value={s.notify_messages} onChange={(v) => patch({ notify_messages: v })} label="Messages" description="Le contenu des messages n’est jamais affiché sur l’écran verrouillé." />
          <Toggle value={s.notify_offers} onChange={(v) => patch({ notify_offers: v })} label="Propositions et accords" />
          <Toggle value={s.notify_social} onChange={(v) => patch({ notify_social: v })} label="Abonnés, commentaires, j’aime" />
          <Toggle value={s.notify_live} onChange={(v) => patch({ notify_live: v })} label="Lives des comptes suivis" />
        </View>
      </ScrollView>
    </Screen>
  );
}
