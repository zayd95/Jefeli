import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  formatAmountInput,
  isPriceMode,
  LISTING_MODE_LABELS,
  parseXOF,
  PRICE_MODES,
  toFrenchError,
  type ItemCondition,
  type ListingMode,
  type PriceMode,
} from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OptionRow } from '@/components/Composer';
import { Button, Chip, colors, Field, Header, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { fetchProduct, updateListing } from '@/lib/api/products';
import type { ProductCard } from '@/lib/types';
import { goBack } from '@/lib/nav';

export default function ListingEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id ?? '') });
  if (q.isPending || !q.data) {
    return (
      <Screen>
        <Header title="Modifier l’article" />
        <Skeleton height={200} style={{ margin: spacing.lg }} />
      </Screen>
    );
  }
  return <ListingForm key={q.data.updated_at} id={id ?? ''} p={q.data} />;
}

function ListingForm({ id, p }: { id: string; p: ProductCard }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description);
  const [price, setPrice] = useState(p.price_xof !== null ? formatAmountInput(String(p.price_xof)) : '');
  const [mode, setMode] = useState<ListingMode>(p.listing_mode);
  const [priceMode, setPriceMode] = useState<PriceMode>(isPriceMode(p.price_mode) ? p.price_mode : 'fixed');
  const [condition, setCondition] = useState<ItemCondition>(p.condition);
  const [quantity, setQuantity] = useState(String(p.quantity));
  const [deliveryNotes, setDeliveryNotes] = useState(p.delivery_notes);
  const [saving, setSaving] = useState(false);

  async function save() {
    const amount = parseXOF(price);
    const effectiveMode: PriceMode = mode === 'trade' ? 'fixed' : priceMode;
    // Same rules as the database: a displayed price needs an amount; « sur demande » stores none.
    if (mode !== 'trade' && effectiveMode === 'fixed' && !(amount && amount > 0)) {
      toast('Indiquez un prix, ou choisissez « Prix sur demande » ou « À discuter ».', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateListing(id, {
        title: title.trim(),
        description: description.trim(),
        price_xof: effectiveMode === 'on_request' ? null : amount && amount > 0 ? amount : null,
        price_mode: effectiveMode,
        listing_mode: mode,
        condition,
        quantity: Math.max(0, Number.parseInt(quantity, 10) || 0),
        delivery_notes: deliveryNotes.trim(),
      });
      qc.invalidateQueries({ queryKey: ['product', id] });
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      toast('Article mis à jour', 'success');
      goBack();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Modifier l’article" right={<Button label="Enregistrer" size="sm" variant="cta" loading={saving} onPress={save} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Field label="Titre" value={title} onChangeText={setTitle} maxLength={80} counter />
        <OptionRow<ListingMode> value={mode} onChange={setMode} options={(['sale', 'trade', 'sale_or_trade'] as ListingMode[]).map((m) => ({ key: m, label: LISTING_MODE_LABELS[m] }))} />
        {mode !== 'trade' ? (
          <OptionRow<PriceMode> value={priceMode} onChange={setPriceMode} options={PRICE_MODES.map((m) => ({ key: m.key, label: m.label }))} />
        ) : null}
        {mode === 'trade' || priceMode !== 'on_request' ? (
          <Field
            label={mode === 'trade' ? 'Valeur estimée (facultatif)' : priceMode === 'negotiable' ? 'Prix de départ (facultatif)' : 'Prix'}
            value={price}
            onChangeText={(t) => setPrice(formatAmountInput(t))}
            keyboardType="number-pad"
            suffix="F CFA"
          />
        ) : (
          <Text variant="caption" tone="secondary">
            Aucun prix n’est affiché : les acheteurs vous écrivent.
          </Text>
        )}
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            État
          </Text>
          <View style={styles.wrap}>
            {CONDITION_OPTIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} selected={condition === c} onPress={() => setCondition(c)} style={condition === c ? undefined : styles.idle} />
            ))}
          </View>
        </View>
        <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={2000} counter />
        <Field label="Quantité" value={quantity} onChangeText={(t) => setQuantity(t.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Field label="Notes de remise" value={deliveryNotes} onChangeText={setDeliveryNotes} maxLength={300} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
