import {
  canRespond,
  canWithdraw,
  describeCashDifference,
  formatXOF,
  OFFER_STATUS_LABELS,
  toFrenchError,
  type OfferStatus,
} from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, colors, radius, spacing, Tag, Text, useToast } from '@/design';
import { respondOffer, withdrawOffer } from '@/lib/api/offers';
import type { AgreementRow, OfferRow, ProductSnapshot } from '@/lib/types';

import { Thumb } from '../Media';

function SnapshotRow({ snap, caption }: { snap: ProductSnapshot; caption: string }) {
  if (!snap) return null;
  return (
    <Pressable onPress={() => router.push(`/p/${snap.id}`)} style={styles.item} accessibilityRole="button" accessibilityLabel={`Voir ${snap.title}`}>
      <Thumb media={snap.image_path ? { storage_path: snap.image_path, kind: 'image', poster_path: null } : null} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700" numberOfLines={2}>
          {snap.title}
        </Text>
        <Text variant="caption" tone="secondary">
          {caption}
          {snap.price_xof !== null ? ` · ${formatXOF(snap.price_xof, { compact: true })}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export function OfferCard({
  offer,
  me,
  agreement,
  otherName,
}: {
  offer: OfferRow;
  me: string;
  agreement?: AgreementRow | null;
  otherName: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const snapshot = offer.snapshot as { product: ProductSnapshot; offered_product: ProductSnapshot };
  const iAmBuyer = offer.buyer_id === me;
  const fromMe = offer.proposer_id === me;
  const status = offer.status as OfferStatus;
  const expired = status === 'pending' && new Date(offer.expires_at).getTime() <= now;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast(ok, 'success');
      qc.invalidateQueries({ queryKey: ['offers', offer.conversation_id] });
      qc.invalidateQueries({ queryKey: ['agreements', offer.conversation_id] });
      qc.invalidateQueries({ queryKey: ['messages', offer.conversation_id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const heading = offer.kind === 'barter' ? 'PROPOSITION DE TROC' : 'OFFRE DE PRIX';
  const who = fromMe ? 'Vous proposez' : `${otherName} propose`;

  return (
    <View style={styles.card} accessibilityLabel={`${heading}, ${OFFER_STATUS_LABELS[status]}`}>
      <View style={styles.head}>
        <Text variant="micro" weight="800" tone="secondary" style={{ letterSpacing: 0.8 }}>
          {heading}
          {offer.parent_offer_id ? ' · CONTRE-PROPOSITION' : ''}
        </Text>
        <Tag
          label={expired ? 'Expirée' : OFFER_STATUS_LABELS[status]}
          tone={status === 'accepted' ? 'mint' : status === 'pending' && !expired ? 'warning' : 'neutral'}
        />
      </View>
      <Text variant="caption" tone="secondary">
        {who}
      </Text>

      {offer.kind === 'barter' ? (
        <View style={{ gap: spacing.sm }}>
          <SnapshotRow snap={snapshot.offered_product} caption={iAmBuyer ? 'Mon article' : `Article de ${otherName}`} />
          <View style={styles.swap}>
            <ArrowLeftRight size={16} color={colors.textSecondary} />
          </View>
          <SnapshotRow snap={snapshot.product} caption={iAmBuyer ? `Article de ${otherName}` : 'Mon article'} />
          <Text variant="callout" weight="700">
            {describeCashDifference(offer.amount_xof, offer.cash_payer as 'buyer' | 'seller' | null, iAmBuyer)}
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <SnapshotRow snap={snapshot.product} caption={iAmBuyer ? `Article de ${otherName}` : 'Mon article'} />
          <Text variant="price">{formatXOF(offer.amount_xof)}</Text>
        </View>
      )}

      {offer.message ? (
        <Text variant="callout" style={{ fontStyle: 'italic' }}>
          « {offer.message} »
        </Text>
      ) : null}

      {!expired && canRespond(offer, me) ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <Button label="Accepter" variant="cta" loading={busy === 'accept'} onPress={() => run('accept', () => respondOffer(offer.id, true), 'Proposition acceptée — accord enregistré')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Contre-proposer"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/offer/[productId]', params: { productId: offer.product_id ?? '', counter: offer.id } })}
            />
            <Button label="Refuser" variant="ghost" size="sm" style={{ flex: 1 }} loading={busy === 'reject'} onPress={() => run('reject', () => respondOffer(offer.id, false), 'Proposition refusée')} />
          </View>
        </View>
      ) : null}
      {!expired && canWithdraw(offer, me) ? (
        <Button label="Retirer ma proposition" variant="ghost" size="sm" loading={busy === 'withdraw'} onPress={() => run('withdraw', () => withdrawOffer(offer.id), 'Proposition retirée')} />
      ) : null}
      {status === 'pending' && !expired && fromMe ? (
        <Text variant="caption" tone="secondary">
          En attente de réponse · expire dans {Math.max(1, Math.round((new Date(offer.expires_at).getTime() - now) / 3_600_000))} h
        </Text>
      ) : null}
      {agreement ? (
        <Button label="Voir l’accord" variant="primary" size="sm" onPress={() => router.push(`/agreement/${agreement.id}`)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, width: '88%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: radius.sm },
  swap: { alignItems: 'center' },
});
