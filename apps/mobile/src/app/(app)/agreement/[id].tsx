import { AGREEMENT_STATUS_LABELS, describeCashDifference, formatXOF, PLATFORM_DISCLAIMER, timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, CheckCircle2, FileX, MapPin, MessageCircle, ShieldAlert, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/Media';
import { Button, Card, colors, EmptyState, Field, Header, radius, Screen, Sheet, Skeleton, spacing, Tag, Text, useToast } from '@/design';
import { closeAgreement, confirmAgreementCompleted, fetchAgreement, leaveReview, myReviewFor } from '@/lib/api/offers';
import { useAuth } from '@/lib/auth';
import type { ProductSnapshot } from '@/lib/types';

type Terms = {
  kind: 'price' | 'barter';
  product: ProductSnapshot;
  offered_product: ProductSnapshot;
  amount_xof: number;
  cash_payer: 'buyer' | 'seller' | null;
  buyer: { id: string; handle: string; display_name: string };
  seller: { id: string; handle: string; display_name: string };
  accepted_at: string;
  disclaimer: string;
};

export default function AgreementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const me = userId ?? '';
  const qc = useQueryClient();
  const toast = useToast();
  const [closing, setClosing] = useState<null | 'canceled' | 'disputed'>(null);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['agreement', id], queryFn: () => fetchAgreement(id ?? '') });
  const mine = useQuery({ queryKey: ['my-review', id], queryFn: () => myReviewFor(id ?? '', me), enabled: q.data?.status === 'completed' });

  if (q.isPending) {
    return (
      <Screen>
        <Header title="Accord" />
        <Skeleton height={200} style={{ margin: spacing.lg }} radius={14} />
      </Screen>
    );
  }
  const a = q.data;
  if (!a) {
    return (
      <Screen>
        <Header title="Accord" />
        <EmptyState icon={FileX} title="Accord introuvable" />
      </Screen>
    );
  }
  const t = a.terms as unknown as Terms;
  const iAmBuyer = a.buyer_id === me;
  const other = iAmBuyer ? t.seller : t.buyer;
  const myConfirmed = iAmBuyer ? a.buyer_completed_at : a.seller_completed_at;
  const otherConfirmed = iAmBuyer ? a.seller_completed_at : a.buyer_completed_at;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast(ok, 'success');
      qc.invalidateQueries({ queryKey: ['agreement', id] });
      qc.invalidateQueries({ queryKey: ['agreements', a?.conversation_id] });
      qc.invalidateQueries({ queryKey: ['my-review', id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t.kind === 'barter' ? 'Accord d’échange' : 'Accord de vente'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tag label={AGREEMENT_STATUS_LABELS[a.status] ?? a.status} tone={a.status === 'completed' ? 'mint' : a.status === 'agreed' ? 'ink' : 'warning'} />
          <Text variant="caption" tone="secondary">
            Conclu {timeAgo(t.accepted_at ?? a.created_at)}
          </Text>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Text variant="micro" weight="800" tone="secondary" style={{ letterSpacing: 0.8 }}>
            TERMES ACCEPTÉS (NON MODIFIABLES)
          </Text>
          {t.kind === 'barter' ? (
            <>
              <SnapRow snap={t.offered_product} caption={`De ${t.buyer.display_name}`} />
              <View style={{ alignItems: 'center' }}>
                <ArrowLeftRight size={18} color={colors.textSecondary} />
              </View>
              <SnapRow snap={t.product} caption={`De ${t.seller.display_name}`} />
              <Text variant="headline">{describeCashDifference(t.amount_xof, t.cash_payer, iAmBuyer)}</Text>
            </>
          ) : (
            <>
              <SnapRow snap={t.product} caption={`Vendu par ${t.seller.display_name}`} />
              <Text variant="title">{formatXOF(t.amount_xof)}</Text>
              <Text variant="caption" tone="secondary">
                Prix convenu entre {t.buyer.display_name} (acheteur) et {t.seller.display_name} (vendeur).
              </Text>
            </>
          )}
        </Card>

        <View style={styles.warning}>
          <ShieldAlert size={18} color={colors.warning} />
          <Text variant="caption" style={{ flex: 1, color: colors.ink }}>
            {t.disclaimer || PLATFORM_DISCLAIMER}
          </Text>
        </View>

        <View style={styles.tips}>
          <MapPin size={16} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            Conseils : rencontrez-vous dans un lieu public et fréquenté, en journée. Vérifiez l’article avant tout paiement. Ne payez jamais d’avance à un inconnu.
          </Text>
        </View>

        <Button label={`Écrire à ${other.display_name}`} variant="outline" icon={MessageCircle} onPress={() => router.push(`/chat/${a.conversation_id}`)} />

        {a.status === 'agreed' ? (
          <Card style={{ gap: spacing.md }}>
            <Text variant="headline">L’échange a eu lieu ?</Text>
            <Text variant="callout" tone="secondary">
              Quand les deux membres l’ont déclaré terminé, chacun peut laisser un avis. {otherConfirmed ? `${other.display_name} l’a déjà déclaré terminé.` : ''}
            </Text>
            {myConfirmed ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <CheckCircle2 size={18} color={colors.success} />
                <Text variant="callout" weight="600">
                  Vous l’avez déclaré terminé. En attente de {other.display_name}.
                </Text>
              </View>
            ) : (
              <Button label="Déclarer l’échange terminé" variant="cta" loading={busy === 'done'} onPress={() => run('done', () => confirmAgreementCompleted(a.id), 'Merci, c’est noté')} />
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Annuler l’accord" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setClosing('canceled')} />
              <Button label="Signaler un litige" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setClosing('disputed')} />
            </View>
          </Card>
        ) : null}

        {a.status === 'completed' ? (
          mine.data ? (
            <Card>
              <Text variant="bodyStrong">Votre avis : {'★'.repeat(mine.data.rating)}</Text>
              {mine.data.body ? <Text variant="callout">{mine.data.body}</Text> : null}
            </Card>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <Text variant="headline">Laisser un avis sur {other.display_name}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} aria-checked={rating === n} accessibilityLabel={`${n} sur 5`} hitSlop={4}>
                    <Star size={32} color={colors.ink} fill={n <= rating ? colors.ink : 'transparent'} />
                  </Pressable>
                ))}
              </View>
              <Field value={review} onChangeText={setReview} multiline maxLength={500} placeholder="Ponctualité, état de l’article, communication…" />
              <Text variant="caption" tone="secondary">
                Votre avis sera publié avec la mention « après un échange déclaré terminé ». Jëfëli ne vérifie pas la transaction.
              </Text>
              <Button label="Publier l’avis" variant="cta" disabled={rating === 0} loading={busy === 'review'} onPress={() => run('review', () => leaveReview(a.id, rating, review.trim()), 'Avis publié')} />
            </Card>
          )
        ) : null}

        {a.status === 'canceled' || a.status === 'disputed' ? (
          <Card>
            <Text variant="bodyStrong">{a.status === 'canceled' ? 'Accord annulé' : 'Litige transmis à la modération'}</Text>
            {a.close_reason ? <Text variant="callout" tone="secondary">Motif : {a.close_reason}</Text> : null}
          </Card>
        ) : null}
      </ScrollView>

      <Sheet visible={!!closing} onClose={() => setClosing(null)} title={closing === 'disputed' ? 'Signaler un litige' : 'Annuler l’accord'}>
        <View style={{ gap: spacing.md }}>
          <Text variant="callout" tone="secondary">
            {closing === 'disputed'
              ? 'Expliquez ce qui s’est passé. L’équipe de modération recevra les termes de l’accord. Jëfëli ne peut pas rembourser ni récupérer un article.'
              : 'L’autre membre sera prévenu. Indiquez brièvement pourquoi.'}
          </Text>
          <Field value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Motif" />
          <Button
            label="Confirmer"
            variant={closing === 'disputed' ? 'danger' : 'primary'}
            disabled={reason.trim().length < 3}
            loading={busy === 'close'}
            onPress={() => {
              const outcome = closing as 'canceled' | 'disputed';
              setClosing(null);
              run('close', () => closeAgreement(a.id, outcome, reason.trim()), outcome === 'disputed' ? 'Litige signalé' : 'Accord annulé');
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function SnapRow({ snap, caption }: { snap: ProductSnapshot; caption: string }) {
  if (!snap) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
      <Thumb media={snap.image_path ? { storage_path: snap.image_path, kind: 'image', poster_path: null } : null} style={{ width: 64, height: 64, borderRadius: radius.sm }} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {snap.title}
        </Text>
        <Text variant="caption" tone="secondary">
          {caption}
          {snap.price_xof !== null ? ` · affiché ${formatXOF(snap.price_xof, { compact: true })}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  tips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
});
