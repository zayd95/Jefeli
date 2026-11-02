import { formatAmountInput, formatXOF, parseXOF, PLATFORM_DISCLAIMER, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Check, PackagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OptionRow } from '@/components/Composer';
import { Thumb } from '@/components/Media';
import { Button, colors, EmptyState, Field, Header, radius, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { counterOffer, fetchOffer, makeOffer } from '@/lib/api/offers';
import { fetchProduct, fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import type { ProductCard } from '@/lib/types';
import { goBack } from '@/lib/nav';

/**
 * Make a price offer or a barter proposal on a listing — or counter an existing offer
 * (?counter=<offerId>). All amounts and ownership are validated again by the server.
 */
export default function OfferComposer() {
  const { productId, kind: kindParam, counter } = useLocalSearchParams<{ productId: string; kind?: string; counter?: string }>();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const product = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId ?? '') });
  const original = useQuery({ queryKey: ['offer', counter], queryFn: () => fetchOffer(counter ?? ''), enabled: !!counter });
  const kind = (original.data?.kind ?? kindParam ?? 'price') as 'price' | 'barter';
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
  const [busy, setBusy] = useState(false);

  // Counter-offers start from the previous terms; explicit choices override them.
  const offered = offeredChoice ?? original.data?.offered_product_id ?? null;
  const payer: 'buyer' | 'seller' = payerChoice ?? ((original.data?.cash_payer as 'buyer' | 'seller' | null) ?? 'buyer');

  const p = product.data;
  const value = parseXOF(amount);
  const tradeables = (myProducts.data ?? []).filter((x) => x.id !== productId);
  const valid = kind === 'price' ? value !== null && value > 0 : !!offered;

  async function submit() {
    if (!p) return;
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
      const created = await fetchOffer(offerId);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast(counter ? 'Contre-proposition envoyée' : kind === 'price' ? 'Offre envoyée' : 'Proposition d’échange envoyée', 'success');
      if (created) router.replace(`/chat/${created.conversation_id}`);
      else goBack();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
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

  const title = counter ? 'Contre-proposition' : kind === 'price' ? 'Faire une offre' : 'Proposer un échange';

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title={title} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
              {p.price_xof !== null ? `Prix affiché : ${formatXOF(p.price_xof)}` : 'À échanger'}
            </Text>
          </View>
        </View>

        {kind === 'price' ? (
          <Field
            label={counter ? 'Votre nouveau prix' : 'Votre offre'}
            value={amount}
            onChangeText={(t) => setAmount(formatAmountInput(t))}
            keyboardType="number-pad"
            placeholder={p.price_xof ? formatAmountInput(String(Math.round(p.price_xof * 0.85))) : '20 000'}
            suffix="F CFA"
            hint={original.data?.amount_xof ? `Proposition précédente : ${formatXOF(original.data.amount_xof)}` : 'Le vendeur peut accepter, refuser ou faire une contre-proposition.'}
          />
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
                    onAction={() => router.push('/publish/listing')}
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

            <Field
              label="Différence en argent (facultatif)"
              value={amount}
              onChangeText={(t) => setAmount(formatAmountInput(t))}
              keyboardType="number-pad"
              placeholder="0"
              suffix="F CFA"
              hint="Pour équilibrer l’échange si les articles n’ont pas la même valeur."
            />
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

        <View style={styles.notice}>
          <Text variant="caption" tone="secondary">
            {PLATFORM_DISCLAIMER}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={counter ? 'Envoyer la contre-proposition' : 'Envoyer la proposition'} variant="cta" size="lg" disabled={!valid} loading={busy} onPress={submit} />
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
        {product.price_xof !== null ? formatXOF(product.price_xof, { compact: true }) : 'Troc'}
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
  target: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { width: '48%', padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionOn: { borderColor: colors.ink, borderWidth: 2 },
  check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: spacing.md, backgroundColor: colors.surfaceSubtle, borderRadius: radius.md },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.border },
});
