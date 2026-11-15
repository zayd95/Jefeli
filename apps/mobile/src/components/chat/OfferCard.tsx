import { canRespond, canWithdraw, describeCashDifference, formatListingPrice, formatXOF, OFFER_STATUS_LABELS, toFrenchError, type OfferStatus } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeftRight, Handshake } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, colors, dark, radius, spacing, Text, useToast } from '@/design';
import { respondOffer, withdrawOffer } from '@/lib/api/offers';
import type { AgreementRow, MessageRow, OfferRow, ProductSnapshot } from '@/lib/types';

import { DealSealed } from '../DealSealed';
import { Thumb } from '../Media';
import { VoiceMessage } from './VoiceMessage';

/**
 * Waxaale card (P1 identity): one offer or counter-offer in the conversation. A gold « WAXAALE »
 * band, the amount (with its gap to the displayed price), the proposer's voice note when there is
 * one, where the negotiation stands (Offre → Réponse → Accord → Échange fait) and the time left
 * before the offer expires. Same actions and rules as before (respond_offer, counter_offer,
 * withdraw_offer): only the presentation changed.
 */

const OFFER_TTL_MS = 72 * 3_600_000;

function SnapshotRow({ snap, caption }: { snap: ProductSnapshot; caption: string }) {
  if (!snap) return null;
  return (
    <Pressable onPress={() => router.push(`/p/${snap.id}`)} style={styles.item} accessibilityRole="button" accessibilityLabel={`Voir ${snap.title}`}>
      <Thumb media={snap.image_path ? { storage_path: snap.image_path, kind: 'image', poster_path: null } : null} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700" tone="fog" numberOfLines={2}>
          {snap.title}
        </Text>
        <Text variant="caption" tone="fogSecondary">
          {caption}
          {` · ${formatListingPrice(snap, { compact: true })}`}
        </Text>
      </View>
    </Pressable>
  );
}

/** Where the negotiation stands: 0 offer, 1 answered, 2 deal, 3 exchange done. */
export function waxaaleStep(status: OfferStatus, agreement?: AgreementRow | null): number {
  if (agreement?.status === 'completed') return 3;
  if (agreement || status === 'accepted') return 2;
  if (status === 'pending') return 0;
  return 1;
}

const STEPS = ['Offre', 'Réponse', 'Accord', 'Échange fait'];

function Steps({ step, closed }: { step: number; closed: boolean }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Étape : ${STEPS[step]}`}>
      {STEPS.map((label, i) => {
        const done = i <= step && !(closed && i === step);
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.stepBar, done && styles.stepBarOn, closed && i === step && styles.stepBarClosed]} />
            <Text variant="micro" weight={i === step ? '800' : '600'} color={i === step ? (closed ? dark.textSecondary : colors.gold) : dark.textSecondary} style={{ fontSize: 10.5 }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function OfferCard({
  offer,
  me,
  agreement,
  otherName,
  voice,
}: {
  offer: OfferRow;
  me: string;
  agreement?: AgreementRow | null;
  otherName: string;
  /** The proposer's voice note for this offer (attach_offer_voice), if any. */
  voice?: MessageRow | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  // Accept / refuse / withdraw: one request at a time, even for two taps in the same frame.
  const inFlight = useRef(false);
  const [now] = useState(() => Date.now());
  const snapshot = offer.snapshot as { product: ProductSnapshot; offered_product: ProductSnapshot };
  const iAmBuyer = offer.buyer_id === me;
  const fromMe = offer.proposer_id === me;
  const status = offer.status as OfferStatus;
  const expiresAt = new Date(offer.expires_at).getTime();
  const expired = status === 'pending' && expiresAt <= now;
  const closed = expired || status === 'rejected' || status === 'withdrawn' || status === 'expired' || status === 'closed';
  const step = waxaaleStep(status, agreement);

  async function run(key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(key);
    try {
      await fn();
      // The deal moment replaces the toast (it says the same thing, bigger).
      if (after) after();
      else toast(ok, 'success');
      qc.invalidateQueries({ queryKey: ['offers', offer.conversation_id] });
      qc.invalidateQueries({ queryKey: ['agreements', offer.conversation_id] });
      qc.invalidateQueries({ queryKey: ['messages', offer.conversation_id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const kindLabel = offer.parent_offer_id ? 'Contre-offre' : offer.kind === 'barter' ? 'Troc' : 'Offre';
  const who = fromMe ? 'Vous proposez' : `${otherName} propose`;
  const listed = snapshot.product?.price_xof ?? null;
  const gap = offer.kind === 'price' && listed && offer.amount_xof ? Math.round(((offer.amount_xof - listed) / listed) * 100) : null;
  const statusLabel = expired ? 'Expirée' : agreement?.status === 'completed' ? 'Échange fait' : OFFER_STATUS_LABELS[status];
  const leftMs = Math.max(0, expiresAt - now);
  const leftH = Math.max(1, Math.round(leftMs / 3_600_000));

  return (
    <>
    <DealSealed visible={sealed} subtitle={`Convenez avec ${otherName} du lieu et du moment de la remise.`} onDone={() => setSealed(false)} />
    <View testID="waxaale-card" style={[styles.card, fromMe ? styles.cardMine : null]} accessibilityLabel={`Waxaale, ${kindLabel}, ${statusLabel}`}>
      <View style={styles.band}>
        <View style={styles.bandLeft}>
          <Handshake size={15} color={colors.gold} strokeWidth={2.4} />
          <Text weight="800" color={colors.gold} style={{ fontSize: 11.5, letterSpacing: 1.4 }}>
            WAXAALE
          </Text>
          <Text weight="700" color={dark.textSecondary} style={{ fontSize: 12 }}>
            · {kindLabel}
          </Text>
        </View>
        <View style={[styles.pill, status === 'accepted' && styles.pillOk, closed && styles.pillOff]}>
          <Text weight="800" color={status === 'accepted' ? colors.onPrimary : closed ? dark.textSecondary : colors.gold} style={{ fontSize: 11 }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text variant="caption" tone="fogSecondary">
          {who}
        </Text>

        {offer.kind === 'barter' ? (
          <View style={{ gap: spacing.sm }}>
            <SnapshotRow snap={snapshot.offered_product} caption={iAmBuyer ? 'Mon article' : `Article de ${otherName}`} />
            <View style={styles.swap}>
              <ArrowLeftRight size={16} color={colors.gold} />
            </View>
            <SnapshotRow snap={snapshot.product} caption={iAmBuyer ? `Article de ${otherName}` : 'Mon article'} />
            <Text variant="callout" weight="700" tone="fog">
              {describeCashDifference(offer.amount_xof, offer.cash_payer as 'buyer' | 'seller' | null, iAmBuyer)}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.amountRow}>
              <Text serif color={closed ? dark.textSecondary : colors.ink} style={[{ fontSize: 34, lineHeight: 38 }, closed && { textDecorationLine: 'line-through' }]}>
                {formatXOF(offer.amount_xof)}
              </Text>
              {gap !== null && gap !== 0 ? (
                <Text variant="caption" weight="700" color={gap < 0 ? colors.gold : dark.gold}>
                  {gap > 0 ? '+' : '−'}
                  {Math.abs(gap)} % du prix
                </Text>
              ) : null}
            </View>
            <SnapshotRow snap={snapshot.product} caption={iAmBuyer ? `Article de ${otherName}` : 'Mon article'} />
          </View>
        )}

        {voice?.attachment_path ? (
          <View style={styles.voice} testID="waxaale-voice">
            <Text variant="micro" weight="800" color={colors.gold} style={{ letterSpacing: 1 }}>
              {fromMe ? 'VOTRE OFFRE À VOIX HAUTE' : `ÉCOUTEZ ${otherName.toUpperCase()}`}
            </Text>
            <VoiceMessage path={voice.attachment_path} durationMs={(voice.attachment_meta as any)?.duration_ms} waveform={(voice.attachment_meta as any)?.waveform} mine={false} />
          </View>
        ) : null}

        {offer.message ? (
          <Text variant="callout" tone="fog" style={{ fontStyle: 'italic' }}>
            « {offer.message} »
          </Text>
        ) : null}

        <Steps step={step} closed={closed} />

        {status === 'pending' && !expired ? (
          <View style={{ gap: 4 }}>
            <View style={styles.timer}>
              <View style={[styles.timerFill, { width: `${Math.min(100, (leftMs / OFFER_TTL_MS) * 100)}%` }]} />
            </View>
            <Text variant="caption" tone="fogSecondary">
              {fromMe ? 'En attente de réponse · ' : ''}expire dans {leftH} h
            </Text>
          </View>
        ) : null}

        {!expired && canRespond(offer, me) ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <Button label="Accepter" variant="cta" loading={busy === 'accept'} onPress={() => run('accept', () => respondOffer(offer.id, true), 'Marché conclu ! L’accord est enregistré.', () => setSealed(true))} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Contre-offre"
                variant="outlineDark"
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
        {agreement ? (
          <Button label={agreement.status === 'completed' ? 'Voir l’échange' : 'Voir l’accord'} variant="outline" size="sm" onPress={() => router.push(`/agreement/${agreement.id}`)} />
        ) : null}
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, borderRadius: radius.xl, overflow: 'hidden', width: '88%', maxWidth: 420 },
  cardMine: { borderColor: dark.goldSoft },
  band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.raised, borderBottomWidth: 1, borderBottomColor: colors.goldLine, paddingHorizontal: spacing.md, paddingVertical: 8 },
  bandLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: dark.background },
  pillOk: { backgroundColor: colors.gold },
  pillOff: { backgroundColor: dark.background, opacity: 0.7 },
  body: { padding: spacing.md, gap: spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  swap: { alignItems: 'center' },
  voice: { gap: 6, backgroundColor: dark.subtle, borderRadius: radius.lg, padding: spacing.sm },
  steps: { flexDirection: 'row', gap: 6, marginTop: spacing.xs },
  step: { flex: 1, gap: 5 },
  stepBar: { height: 3, borderRadius: 2, backgroundColor: dark.border },
  stepBarOn: { backgroundColor: colors.gold },
  stepBarClosed: { backgroundColor: dark.textSecondary },
  timer: { height: 4, borderRadius: 2, backgroundColor: dark.border, overflow: 'hidden' },
  timerFill: { height: 4, borderRadius: 2, backgroundColor: colors.gold },
});
