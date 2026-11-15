import { AGREEMENT_STATUS_LABELS, describeCashDifference, formatXOF, PLATFORM_DISCLAIMER, timeAgo, toFrenchError, formatListingPrice, hasDisplayedPrice } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, CalendarClock, CheckCircle2, FileX, MapPin, MessageCircle, ShieldAlert, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DealSealed } from '@/components/DealSealed';
import { Thumb } from '@/components/Media';
import { Button, Card, Chip, colors, EmptyState, Field, Header, radius, Screen, Sheet, Skeleton, spacing, Tag, Text, useToast } from '@/design';
import { closeAgreement, confirmAgreementCompleted, fetchAgreement, leaveReview, myReviewFor, setAgreementHandover } from '@/lib/api/offers';
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
  const [sealed, setSealed] = useState(false);

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
      const result = await fn();
      // Both sides have now confirmed: the exchange is done — the brand moment (P1).
      if (key === 'done' && result === 'completed') setSealed(true);
      else toast(ok, 'success');
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
      <DealSealed visible={sealed} title="Échange fait !" subtitle={`Bravo. Laissez un avis à ${other.display_name} : c’est ce qui construit la confiance.`} onDone={() => setSealed(false)} />
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

        {a.status === 'agreed' ? <Handover agreement={a} me={me} otherName={other.display_name} busy={busy === 'handover'} onSave={(at, place) => run('handover', () => setAgreementHandover(a.id, at, place), 'Remise proposée')} /> : null}

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

const DAYS = [
  { key: 0, label: 'Aujourd’hui' },
  { key: 1, label: 'Demain' },
  { key: 2, label: 'Après-demain' },
];
const HOURS = [10, 13, 16, 18, 20];

/** The handover moment: the next slot of the chosen day and hour, local time. */
function handoverDate(dayOffset: number, hour: number, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const WHEN = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Pilot cut (c) — « Remise » step of an open agreement: either member proposes where and when
 * they meet; the other sees it here and in the chat, and can propose another slot.
 */
function Handover({
  agreement,
  me,
  otherName,
  busy,
  onSave,
}: {
  agreement: { handover_at: string | null; handover_place: string | null; handover_by: string | null };
  me: string;
  otherName: string;
  busy: boolean;
  onSave: (at: string, place: string) => void;
}) {
  const set = !!agreement.handover_at && !!agreement.handover_place;
  const [editing, setEditing] = useState(!set);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(18);
  const [place, setPlace] = useState(agreement.handover_place ?? '');
  const now = new Date();
  const slot = handoverDate(day, hour, now);
  const past = slot.getTime() < now.getTime();
  return (
    <Card style={{ gap: spacing.md }} testID="handover-card">
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <CalendarClock size={18} color={colors.gold} />
        <Text variant="headline">Remise</Text>
      </View>
      {set && !editing ? (
        <>
          <Text variant="bodyStrong">{WHEN.format(new Date(agreement.handover_at!))}</Text>
          <Text variant="callout">{agreement.handover_place}</Text>
          <Text variant="caption" tone="secondary">
            {agreement.handover_by === me ? `Vous l’avez proposé. ${otherName} est prévenu(e).` : `Proposé par ${otherName}.`}
          </Text>
          <Button label="Proposer un autre moment" variant="ghost" size="sm" onPress={() => setEditing(true)} />
        </>
      ) : (
        <>
          <Text variant="callout" tone="secondary">
            Choisissez un lieu public et une heure. {otherName} sera prévenu(e) dans la discussion.
          </Text>
          <View style={styles.chips}>
            {DAYS.map((d) => (
              <Chip key={d.key} label={d.label} selected={day === d.key} onPress={() => setDay(d.key)} />
            ))}
          </View>
          <View style={styles.chips}>
            {HOURS.map((h) => (
              <Chip key={h} label={`${h} h`} selected={hour === h} onPress={() => setHour(h)} />
            ))}
          </View>
          <Field label="Lieu" value={place} onChangeText={setPlace} maxLength={120} placeholder="Ex. Station Total, VDN" />
          {past ? (
            <Text variant="caption" tone="secondary">
              Cette heure est passée : choisissez plus tard.
            </Text>
          ) : null}
          <Button
            label="Proposer la remise"
            variant="outline"
            disabled={past || place.trim().length < 2}
            loading={busy}
            onPress={() => {
              onSave(slot.toISOString(), place.trim());
              setEditing(false);
            }}
          />
        </>
      )}
    </Card>
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
          {` · ${hasDisplayedPrice(snap) ? 'affiché ' : ''}${formatListingPrice(snap, { compact: true })}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  tips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
