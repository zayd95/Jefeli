import { formatAmountInput, formatXOF, parseXOF, PLATFORM_DISCLAIMER, toFrenchError, formatListingPrice, hasDisplayedPrice } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Check, Mic, PackagePlus, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { VoicePreview } from '@/components/audio/Voice';
import { VoiceRecorderPanel, type RecordedClip } from '@/components/audio/VoiceRecorder';
import { OptionRow } from '@/components/Composer';
import { Thumb } from '@/components/Media';
import { Button, colors, EmptyState, Field, Header, radius, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { attachOfferVoice, counterOffer, fetchOffer, makeOffer } from '@/lib/api/offers';
import { fetchProduct, fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import type { ProductCard } from '@/lib/types';
import { useFlag } from '@/lib/flags';
import { goBack } from '@/lib/nav';
import { newObjectPath, uploadWithRetry } from '@/lib/upload';
import { STUDIO } from '@/lib/studioLinks';

/**
 * Make a price offer or a barter proposal on a listing — or counter an existing offer
 * (?counter=<offerId>). All amounts and ownership are validated again by the server.
 */
/** A round, friendly amount: 50 F under 2 000 F, 100 F under 10 000 F, 500 F above. */
function niceRound(n: number): number {
  const step = n >= 10_000 ? 500 : n >= 2_000 ? 100 : 50;
  return Math.max(step, Math.round(n / step) * step);
}

export default function OfferComposer() {
  const { productId, kind: kindParam, counter } = useLocalSearchParams<{ productId: string; kind?: string; counter?: string }>();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const product = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId ?? '') });
  const original = useQuery({ queryKey: ['offer', counter], queryFn: () => fetchOffer(counter ?? ''), enabled: !!counter });
  // P3: an article that accepts both an offer and a swap is one screen with an « Offre | Échange » switch.
  const [kindChoice, setKindChoice] = useState<'price' | 'barter' | null>(null);
  const kind = (original.data?.kind ?? kindChoice ?? kindParam ?? 'price') as 'price' | 'barter';
  const iAmBuyer = original.data ? original.data.buyer_id === userId : true;
  const buyerId = original.data?.buyer_id ?? userId ?? '';
  const myProducts = useQuery({
    queryKey: ['tradeable', buyerId],
    queryFn: () => fetchSellerProducts(buyerId, { onlyActive: true }),
    enabled: kind === 'barter' && !!buyerId,
  });

  const [amount, setAmount] = useState('');
  const [offeredChoice, setOffered] = useState<string | null>(null);
  const [payerChoice, setPayer] = useState<'buyer' | 'seller' | null>(null);
  const [message, setMessage] = useState('');
  const [showCash, setShowCash] = useState(false);
  const [busy, setBusy] = useState(false);
  // Waxaale (P1): the offer can be said out loud; the note is attached once the offer exists.
  const voiceEnabled = useFlag('voice_messages');
  const [recording, setRecording] = useState(false);
  const [voice, setVoice] = useState<RecordedClip | null>(null);
  // State updates land after the next render; two taps in one frame would both pass `busy`.
  const inFlight = useRef(false);

  // Counter-offers start from the previous terms; explicit choices override them.
  const offered = offeredChoice ?? original.data?.offered_product_id ?? null;
  const payer: 'buyer' | 'seller' = payerChoice ?? ((original.data?.cash_payer as 'buyer' | 'seller' | null) ?? 'buyer');

  const p = product.data;
  const value = parseXOF(amount);
  const tradeables = (myProducts.data ?? []).filter((x) => x.id !== productId);
  const valid = kind === 'price' ? value !== null && value > 0 : !!offered;
  const asking = p && hasDisplayedPrice(p) && p.price_xof ? p.price_xof : null;

  async function submit() {
    if (!p || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const args = {
        amount: kind === 'price' ? (value ?? 0) : (value ?? 0),
        offeredProductId: kind === 'barter' ? offered : null,
        cashPayer: kind === 'barter' && (value ?? 0) > 0 ? payer : null,
        message: message.trim(),
      };
      const offerId = counter
        ? await counterOffer({ offerId: counter, ...args })
        : await makeOffer({ productId: p.id, kind, ...args });
      let voiceFailed = false;
      if (voice && userId) {
        try {
          const path = newObjectPath(userId, 'messages', voice.mimeType);
          await uploadWithRetry({ bucket: 'private-media', path, uri: voice.uri, mimeType: voice.mimeType, file: voice.file instanceof Blob ? voice.file : null });
          await attachOfferVoice(offerId, path, { duration_ms: Math.round(voice.durationMs), waveform: voice.waveform });
        } catch {
          voiceFailed = true;
        }
      }
      const created = await fetchOffer(offerId);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast(
        voiceFailed
          ? 'Proposition envoyée, mais le message vocal n’a pas pu partir. Renvoyez-le dans la conversation.'
          : counter
            ? 'Contre-offre envoyée'
            : kind === 'price'
              ? 'Offre envoyée'
              : 'Proposition d’échange envoyée',
        voiceFailed ? 'error' : 'success',
      );
      if (created) router.replace(`/chat/${created.conversation_id}`);
      else goBack();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (product.isPending || (counter && original.isPending)) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Proposition" />
        <Skeleton height={90} style={{ margin: spacing.lg }} />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Proposition" />
        <EmptyState icon={PackagePlus} title="Article indisponible" />
      </Screen>
    );
  }

  const title = counter ? 'Contre-offre' : kind === 'price' ? 'Faire une offre' : 'Proposer un échange';

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title={title} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!counter && p.listing_mode === 'sale_or_trade' ? (
          <View style={styles.kindSwitch} accessibilityRole="tablist" accessibilityLabel="Offre ou échange">
            {([['price', 'Offre'], ['barter', 'Échange']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setKindChoice(k)} style={[styles.kindItem, kind === k && styles.kindOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === k }} aria-selected={kind === k} accessibilityLabel={label === 'Offre' ? 'Faire une offre en argent' : 'Proposer un échange (troc)'} testID={`offer-kind-${k}`}>
                <Text variant="callout" weight="700" color={colors.ink}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.target}>
          <Thumb media={p.media[0]} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="secondary">
              Article de {p.seller?.display_name}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {p.title}
            </Text>
            <Text variant="callout" weight="700">
              {hasDisplayedPrice(p) ? `Prix affiché : ${formatListingPrice(p)}` : formatListingPrice(p)}
            </Text>
          </View>
        </View>

        {kind === 'price' ? (
          <View style={{ gap: spacing.sm }}>
            <Field
              label={counter ? 'Votre nouveau prix' : 'Votre offre'}
              value={amount}
              onChangeText={(t) => setAmount(formatAmountInput(t))}
              keyboardType="number-pad"
              placeholder={hasDisplayedPrice(p) && p.price_xof ? formatAmountInput(String(niceRound(p.price_xof * 0.85))) : '20 000'}
              suffix="F CFA"
              hint={
                original.data?.amount_xof
                  ? `Proposition précédente : ${formatXOF(original.data.amount_xof)}`
                  : asking && value
                    ? value === asking
                      ? 'Au prix affiché : le vendeur n’a qu’à accepter.'
                      : value < asking
                        ? `${Math.round((1 - value / asking) * 100)} % sous le prix affiché.`
                        : 'Plus que le prix affiché.'
                    : 'Le vendeur peut accepter, refuser ou faire une contre-proposition.'
              }
            />
            {asking ? (
              <View style={styles.quick} accessibilityLabel="Montants rapides">
                {[{ key: 'ask', label: 'Prix demandé', amt: asking }, ...[10, 15, 20].map((pct) => ({ key: `m${pct}`, label: `−${pct} %`, amt: niceRound(asking * (1 - pct / 100)) }))].map((q) => (
                  <Pressable key={q.key} onPress={() => setAmount(formatAmountInput(String(q.amt)))} style={[styles.quickChip, value === q.amt && styles.quickOn]} accessibilityRole="button" accessibilityLabel={`Offrir ${formatXOF(q.amt)} (${q.label})`} testID={`offer-quick-${q.key}`}>
                    <Text variant="callout" weight={value === q.amt ? '800' : '600'} color={colors.ink}>
                      {q.label}
                    </Text>
                    <Text variant="caption" weight="600" tone="secondary">
                      {formatAmountInput(String(q.amt))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {iAmBuyer ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="callout" weight="600">
                  Que proposez-vous en échange ?
                </Text>
                {myProducts.isPending ? (
                  <Skeleton height={120} />
                ) : tradeables.length === 0 ? (
                  <EmptyState
                    compact
                    icon={ArrowLeftRight}
                    title="Aucun article à proposer"
                    body="Publiez d’abord l’article que vous souhaitez échanger. Il doit vous appartenir et être disponible."
                    actionLabel="Publier un article"
                    actionVariant="outline"
                    onAction={() => router.push(STUDIO.article)}
                  />
                ) : (
                  <View style={styles.grid}>
                    {tradeables.map((t) => (
                      <TradeOption key={t.id} product={t} selected={offered === t.id} onPress={() => setOffered(t.id)} />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <Text tone="secondary">
                Vous pouvez ajuster la différence d’argent. L’article proposé reste celui choisi par l’acheteur.
              </Text>
            )}

            {showCash || (value ?? 0) > 0 || counter ? (
            <Field
              label="Différence en argent (facultatif)"
              value={amount}
              onChangeText={(t) => setAmount(formatAmountInput(t))}
              keyboardType="number-pad"
              placeholder="0"
              suffix="F CFA"
              hint="Pour équilibrer l’échange si les articles n’ont pas la même valeur."
            />
            ) : (
              <Pressable onPress={() => setShowCash(true)} style={styles.addCash} accessibilityRole="button" accessibilityLabel="Ajouter une différence d’argent" testID="offer-add-cash">
                <Text variant="callout" weight="700" color={colors.ink}>
                  + Ajouter une différence d’argent
                </Text>
              </Pressable>
            )}
            {(value ?? 0) > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="callout" weight="600">
                  Qui paie la différence ?
                </Text>
                <OptionRow<'buyer' | 'seller'>
                  value={payer}
                  onChange={setPayer}
                  options={[
                    { key: 'buyer', label: iAmBuyer ? 'Moi' : 'L’acheteur', hint: 'celui qui propose l’échange' },
                    { key: 'seller', label: iAmBuyer ? 'Le vendeur' : 'Moi', hint: 'propriétaire de l’article' },
                  ]}
                />
              </View>
            ) : null}
          </>
        )}

        <Field label="Message (facultatif)" value={message} onChangeText={setMessage} multiline maxLength={500} placeholder="Ex. Je peux passer le chercher samedi à Médina." />

        {voiceEnabled ? (
          <View style={styles.voice} testID="offer-voice">
            <Text variant="callout" weight="700">
              Message vocal (facultatif)
            </Text>
            {voice ? (
              <View style={{ gap: spacing.sm }}>
                <VoicePreview uri={voice.uri} durationMs={voice.durationMs} waveform={voice.waveform} />
                <Button label="Retirer le message vocal" size="sm" variant="ghost" icon={Trash2} onPress={() => setVoice(null)} />
              </View>
            ) : recording ? (
              <VoiceRecorderPanel
                useLabel="Joindre à l’offre"
                onUse={(c) => {
                  setVoice(c);
                  setRecording(false);
                }}
                onCancel={() => setRecording(false)}
              />
            ) : (
              <Button label="Enregistrer ma voix" size="sm" variant="outline" icon={Mic} onPress={() => setRecording(true)} />
            )}
          </View>
        ) : null}

        <View style={styles.notice}>
          <Text variant="caption" tone="secondary">
            {PLATFORM_DISCLAIMER}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={counter ? 'Envoyer la contre-offre' : 'Envoyer la proposition'} variant="cta" size="lg" disabled={!valid} loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}

function TradeOption({ product, selected, onPress }: { product: ProductCard; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ selected }} aria-checked={selected} accessibilityLabel={product.title}>
      <Thumb media={product.media[0]} style={{ height: 100, borderRadius: radius.sm }} />
      <Text variant="caption" weight="600" numberOfLines={1} style={{ marginTop: 6 }}>
        {product.title}
      </Text>
      <Text variant="caption" tone="secondary">
        {formatListingPrice(product, { compact: true })}
      </Text>
      {selected ? (
        <View style={styles.check}>
          <Check size={14} color={colors.ink} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  kindSwitch: { flexDirection: 'row', alignSelf: 'stretch', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  kindItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  kindOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  target: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: { minHeight: 52, minWidth: 74, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quickOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  addCash: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  option: { width: '48%', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionOn: { borderColor: colors.ink, borderWidth: 2 },
  check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
  voice: { gap: spacing.sm },
  notice: { paddingTop: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border },
});
