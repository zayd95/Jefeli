import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  formatAmountInput,
  LISTING_MODE_LABELS,
  parseXOF,
  toFrenchError,
  type ItemCondition,
  type ListingMode,
} from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OptionRow } from '@/components/Composer';
import { Button, Chip, colors, Field, Header, Screen, Skeleton, spacing, Text, useToast } from '@/design';
import { fetchProduct, updateListing } from '@/lib/api/products';

export default function ListingEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id ?? '') });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<ListingMode>('sale');
  const [condition, setCondition] = useState<ItemCondition>('new');
  const [quantity, setQuantity] = useState('1');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = q.data;
    if (!p) return;
    setTitle(p.title);
    setDescription(p.description);
    setPrice(p.price_xof !== null ? formatAmountInput(String(p.price_xof)) : '');
    setMode(p.listing_mode);
    setCondition(p.condition);
    setQuantity(String(p.quantity));
    setDeliveryNotes(p.delivery_notes);
  }, [q.data]);

  async function save() {
    setSaving(true);
    try {
      await updateListing(id ?? '', {
        title: title.trim(),
        description: description.trim(),
        price_xof: parseXOF(price),
        listing_mode: mode,
        condition,
        quantity: Math.max(0, Number.parseInt(quantity, 10) || 0),
        delivery_notes: deliveryNotes.trim(),
      });
      qc.invalidateQueries({ queryKey: ['product', id] });
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      toast('Article mis à jour', 'success');
      router.back();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (q.isPending) {
    return (
      <Screen>
        <Header title="Modifier l’article" />
        <Skeleton height={200} style={{ margin: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Modifier l’article" right={<Button label="Enregistrer" size="sm" variant="cta" loading={saving} onPress={save} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Field label="Titre" value={title} onChangeText={setTitle} maxLength={80} counter />
        <OptionRow<ListingMode> value={mode} onChange={setMode} options={(['sale', 'trade', 'sale_or_trade'] as ListingMode[]).map((m) => ({ key: m, label: LISTING_MODE_LABELS[m] }))} />
        <Field label={mode === 'trade' ? 'Valeur estimée (facultatif)' : 'Prix'} value={price} onChangeText={(t) => setPrice(formatAmountInput(t))} keyboardType="number-pad" suffix="F CFA" />
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
