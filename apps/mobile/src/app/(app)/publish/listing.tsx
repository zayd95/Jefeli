import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  DELIVERY_LABELS,
  formatAmountInput,
  LISTING_MODE_LABELS,
  parseXOF,
  toFrenchError,
  type ItemCondition,
  type ListingMode,
} from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MediaPickerStrip, OptionRow, UploadOverlay } from '@/components/Composer';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Chip, colors, Field, Header, radius, Screen, spacing, Text, Toggle, useToast } from '@/design';
import { createPost } from '@/lib/api/posts';
import { createListing, fetchCategories } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/drafts';
import { uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';

const MODES: ListingMode[] = ['sale', 'trade', 'sale_or_trade'];

export default function NewListing() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const draft = useDraft('listing', {
    media: [] as LocalMedia[],
    title: '',
    description: '',
    price: '',
    mode: 'sale' as ListingMode,
    category: '',
    condition: 'new' as ItemCondition,
    quantity: 1,
    city: profile?.city ?? 'Dakar',
    neighborhood: profile?.neighborhood ?? '',
    delivery: ['pickup'] as string[],
    deliveryNotes: '',
    alsoPost: true,
  });
  const v = draft.value;
  const set = (patch: Partial<typeof v>) => draft.setValue((cur) => ({ ...cur, ...patch }));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });

  const price = parseXOF(v.price);
  const errors = {
    media: v.media.length === 0 ? 'Ajoutez au moins une photo.' : null,
    title: v.title.trim().length < 3 ? 'Donnez un titre (3 caractères minimum).' : null,
    price: v.mode !== 'trade' && price === null ? 'Indiquez un prix en F CFA.' : null,
    category: !v.category ? 'Choisissez une catégorie.' : null,
    city: !v.city.trim() ? 'Indiquez une ville.' : null,
    delivery: v.delivery.length === 0 ? 'Choisissez au moins un mode de remise.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  async function publish() {
    if (!valid) {
      setShowErrors(true);
      toast('Complétez les champs indiqués', 'error');
      return;
    }
    if (!userId) return;
    abort.current = new AbortController();
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await uploadMediaBatch(userId, v.media.map((m) => ({ ...m, file: null })), {
        bucket: 'public-media',
        folder: 'listings',
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      const id = await createListing(
        {
          title: v.title.trim(),
          description: v.description.trim(),
          price_xof: v.mode === 'trade' ? price : price,
          category_slug: v.category,
          condition: v.condition,
          listing_mode: v.mode,
          quantity: v.quantity,
          city: v.city.trim(),
          neighborhood: v.neighborhood.trim(),
          delivery_options: v.delivery,
          delivery_notes: v.deliveryNotes.trim(),
        },
        uploaded,
      );
      if (v.alsoPost) {
        // Same files, no second upload: also share it in the social feed, tagged.
        await createPost({ body: v.title.trim(), visibility: 'public', media: uploaded, productIds: [id] }).catch(() => null);
      }
      await draft.clear();
      qc.invalidateQueries({ queryKey: ['seller-products', userId] });
      qc.invalidateQueries({ queryKey: ['my-active-products', userId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['explore'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('Article publié dans votre boutique', 'success');
      router.replace(`/p/${id}`);
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Nouvel article" right={<Button label="Publier" size="sm" variant="cta" onPress={publish} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {draft.restored ? (
          <Text variant="caption" tone="secondary">
            Brouillon restauré.{' '}
            <Text variant="caption" tone="accent" weight="700" onPress={() => draft.clear()}>
              Recommencer
            </Text>
          </Text>
        ) : null}
        <View>
          <MediaPickerStrip media={v.media} onChange={(m) => set({ media: m })} required label="Photos et vidéos de l’article" />
          {err('media') ? <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>{err('media')}</Text> : null}
        </View>

        <Field label="Titre *" value={v.title} onChangeText={(t) => set({ title: t })} placeholder="Ex. Robe wax taille M, iPhone 12 128 Go…" maxLength={80} counter error={err('title')} />

        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Type d’annonce
          </Text>
          <OptionRow<ListingMode>
            value={v.mode}
            onChange={(m) => set({ mode: m })}
            options={MODES.map((m) => ({ key: m, label: LISTING_MODE_LABELS[m] }))}
          />
        </View>

        {v.mode !== 'trade' ? (
          <Field
            label="Prix *"
            value={v.price}
            onChangeText={(t) => set({ price: formatAmountInput(t) })}
            keyboardType="number-pad"
            placeholder="25 000"
            suffix="F CFA"
            error={err('price')}
            hint="Paiement convenu directement entre vous (espèces, Wave, Orange Money…). Jëfëli ne prend aucune commission pendant le pilote."
          />
        ) : (
          <Field
            label="Valeur estimée (facultatif)"
            value={v.price}
            onChangeText={(t) => set({ price: formatAmountInput(t) })}
            keyboardType="number-pad"
            placeholder="Aide à équilibrer un troc"
            suffix="F CFA"
          />
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Catégorie *
          </Text>
          <View style={styles.wrap}>
            {(categories.data ?? []).map((c) => (
              <Chip key={c.slug} label={c.name} selected={v.category === c.slug} onPress={() => set({ category: c.slug })} style={v.category === c.slug ? undefined : styles.idle} />
            ))}
          </View>
          {err('category') ? <Text variant="caption" tone="danger">{err('category')}</Text> : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            État
          </Text>
          <View style={styles.wrap}>
            {CONDITION_OPTIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} selected={v.condition === c} onPress={() => set({ condition: c })} style={v.condition === c ? undefined : styles.idle} />
            ))}
          </View>
        </View>

        <Field label="Description" value={v.description} onChangeText={(t) => set({ description: t })} multiline maxLength={2000} counter placeholder="Taille, couleur, défauts éventuels, ce qui est inclus…" />

        <View style={styles.qtyRow}>
          <View style={{ flex: 1 }}>
            <Text variant="callout" weight="600">
              Quantité disponible
            </Text>
            <Text variant="caption" tone="secondary">
              1 pour un article unique, plus pour un stock simple.
            </Text>
          </View>
          <Pressable onPress={() => set({ quantity: Math.max(1, v.quantity - 1) })} style={styles.qtyBtn} accessibilityLabel="Diminuer la quantité">
            <Minus size={18} color={colors.ink} />
          </Pressable>
          <Text variant="headline" style={{ minWidth: 32, textAlign: 'center' }}>
            {v.quantity}
          </Text>
          <Pressable onPress={() => set({ quantity: Math.min(9999, v.quantity + 1) })} style={styles.qtyBtn} accessibilityLabel="Augmenter la quantité">
            <Plus size={18} color={colors.ink} />
          </Pressable>
        </View>

        <LocationPicker city={v.city} neighborhood={v.neighborhood} onChange={(n) => set({ city: n.city, neighborhood: n.neighborhood })} compact />

        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Remise de l’article *
          </Text>
          <View style={styles.wrap}>
            {Object.entries(DELIVERY_LABELS).map(([k, label]) => {
              const on = v.delivery.includes(k);
              return <Chip key={k} label={label} selected={on} onPress={() => set({ delivery: on ? v.delivery.filter((x) => x !== k) : [...v.delivery, k] })} style={on ? undefined : styles.idle} />;
            })}
          </View>
          {err('delivery') ? <Text variant="caption" tone="danger">{err('delivery')}</Text> : null}
          <Field value={v.deliveryNotes} onChangeText={(t) => set({ deliveryNotes: t })} placeholder="Ex. Livraison Dakar 1 000 F, retrait à Sacré-Cœur" maxLength={300} />
        </View>

        <Toggle value={v.alsoPost} onChange={(b) => set({ alsoPost: b })} label="Partager aussi dans mon fil" description="Crée une publication qui identifie cet article (mêmes photos)." />
      </ScrollView>
      <UploadOverlay visible={uploading} progress={progress} label="Publication de l’article…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
