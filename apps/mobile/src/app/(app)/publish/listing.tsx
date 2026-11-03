/**
 * New listing in three short steps (progressive disclosure, sensible defaults, draft kept):
 *   1. L’essentiel — media, title, listing mode, how the price is shown
 *   2. Détails     — category, condition, description, quantity
 *   3. Remise      — place, handover, optional delivery note, publish
 * A price is required only for « Prix affiché » sales; « Prix sur demande » and « À discuter »
 * work without one. The database enforces the same rules (create_listing).
 */
import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  DELIVERY_LABELS,
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
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaPickerStrip, OptionRow, UploadOverlay } from '@/components/Composer';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Chip, colors, Field, Header, ProgressBar, radius, Screen, spacing, Text, Toggle, useToast } from '@/design';
import { createPost } from '@/lib/api/posts';
import { createListing, fetchCategories } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/drafts';
import { uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';

const MODES: ListingMode[] = ['sale', 'sale_or_trade', 'trade'];
const STEPS = ['L’essentiel', 'Détails', 'Remise'] as const;
const FEATURED_CATEGORIES = 8;

export default function NewListing() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const draft = useDraft('listing', {
    media: [] as LocalMedia[],
    title: '',
    description: '',
    price: '',
    priceMode: 'fixed' as PriceMode,
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
  const priceMode: PriceMode = isPriceMode(v.priceMode) ? v.priceMode : 'fixed';
  const set = (patch: Partial<typeof v>) => draft.setValue((cur) => ({ ...cur, ...patch }));
  const [step, setStep] = useState(0);
  const [allCategories, setAllCategories] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showErrors, setShowErrors] = useState<boolean[]>([false, false, false]);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });

  const isTrade = v.mode === 'trade';
  const price = parseXOF(v.price);
  // What is sent: no hidden price for « Prix sur demande »; trade listings may carry a value.
  const sentPrice = !isTrade && priceMode === 'on_request' ? null : price && price > 0 ? price : null;
  const errors = [
    {
      media: v.media.length === 0 ? 'Ajoutez au moins une photo.' : null,
      title: v.title.trim().length < 3 ? 'Donnez un titre (3 caractères minimum).' : null,
      price: !isTrade && priceMode === 'fixed' && !sentPrice ? 'Indiquez un prix, ou choisissez « Prix sur demande » ou « À discuter ».' : null,
    },
    { category: !v.category ? 'Choisissez une catégorie.' : null },
    {
      city: !v.city.trim() ? 'Indiquez une ville.' : null,
      delivery: v.delivery.length === 0 ? 'Choisissez au moins un mode de remise.' : null,
    },
  ] as const;
  const stepValid = (i: number) => Object.values(errors[i]!).every((e) => !e);
  const err = (i: number, k: string) => (showErrors[i] ? ((errors[i] as Record<string, string | null>)[k] ?? null) : null);

  function next() {
    if (!stepValid(step)) {
      setShowErrors((s) => s.map((x, i) => (i === step ? true : x)));
      toast('Complétez les champs indiqués', 'error');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function publish() {
    const firstInvalid = [0, 1, 2].find((i) => !stepValid(i));
    if (firstInvalid !== undefined) {
      setShowErrors((s) => s.map((x, i) => (i === firstInvalid ? true : x)));
      setStep(firstInvalid);
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
          price_xof: sentPrice,
          price_mode: isTrade ? 'fixed' : priceMode,
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

  const cats = categories.data ?? [];
  const selectedCategory = cats.find((c) => c.slug === v.category);
  const visibleCats = allCategories ? cats : cats.slice(0, FEATURED_CATEGORIES).concat(selectedCategory && cats.indexOf(selectedCategory) >= FEATURED_CATEGORIES ? [selectedCategory] : []);
  const last = step === STEPS.length - 1;

  return (
    <Screen edges={['top']} keyboard>
      <Header title="Nouvel article" />
      <View style={styles.stepper}>
        <View style={styles.stepLabels}>
          <Text variant="caption" weight="700">
            Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
          </Text>
          {draft.restored ? (
            <Text variant="caption" tone="accent" weight="700" onPress={() => draft.clear()}>
              Recommencer
            </Text>
          ) : null}
        </View>
        <ProgressBar value={(step + 1) / STEPS.length} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <View>
              <MediaPickerStrip media={v.media} onChange={(m) => set({ media: m })} required label="Photos et vidéos" />
              {err(0, 'media') ? <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>{err(0, 'media')}</Text> : null}
            </View>

            <Field label="Titre" value={v.title} onChangeText={(t) => set({ title: t })} placeholder="Ex. Robe wax taille M, iPhone 12 128 Go…" maxLength={80} counter error={err(0, 'title')} />

            <View style={styles.group}>
              <Text variant="callout" weight="600">
                Je souhaite
              </Text>
              <OptionRow<ListingMode> value={v.mode} onChange={(m) => set({ mode: m })} options={MODES.map((m) => ({ key: m, label: LISTING_MODE_LABELS[m] }))} />
            </View>

            {isTrade ? (
              <Field
                label="Valeur estimée (facultatif)"
                value={v.price}
                onChangeText={(t) => set({ price: formatAmountInput(t) })}
                keyboardType="number-pad"
                placeholder="Aide à équilibrer un troc"
                suffix="F CFA"
              />
            ) : (
              <View style={styles.group}>
                <Text variant="callout" weight="600">
                  Prix
                </Text>
                <OptionRow<PriceMode> value={priceMode} onChange={(m) => set({ priceMode: m })} options={PRICE_MODES.map((m) => ({ key: m.key, label: m.label }))} />
                {priceMode === 'on_request' ? (
                  <Text variant="caption" tone="secondary">
                    {PRICE_MODES.find((m) => m.key === 'on_request')?.hint} Aucun prix n’est affiché.
                  </Text>
                ) : (
                  <Field
                    value={v.price}
                    onChangeText={(t) => set({ price: formatAmountInput(t) })}
                    keyboardType="number-pad"
                    placeholder={priceMode === 'fixed' ? 'Montant' : 'Prix de départ (facultatif)'}
                    suffix="F CFA"
                    accessibilityLabel={priceMode === 'fixed' ? 'Prix' : 'Prix de départ (facultatif)'}
                    error={err(0, 'price')}
                    hint={priceMode === 'negotiable' ? PRICE_MODES.find((m) => m.key === 'negotiable')?.hint : undefined}
                  />
                )}
              </View>
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.group}>
              <Text variant="callout" weight="600">
                Catégorie
              </Text>
              <View style={styles.wrap}>
                {visibleCats.map((c) => (
                  <Chip key={c.slug} label={c.name} selected={v.category === c.slug} onPress={() => set({ category: c.slug })} style={v.category === c.slug ? undefined : styles.idle} />
                ))}
                {cats.length > FEATURED_CATEGORIES ? (
                  <Chip label={allCategories ? 'Moins' : `Voir tout (${cats.length})`} onPress={() => setAllCategories((x) => !x)} style={styles.more} />
                ) : null}
              </View>
              {err(1, 'category') ? <Text variant="caption" tone="danger">{err(1, 'category')}</Text> : null}
            </View>

            <View style={styles.group}>
              <Text variant="callout" weight="600">
                État
              </Text>
              <View style={styles.wrap}>
                {CONDITION_OPTIONS.map((c) => (
                  <Chip key={c} label={CONDITION_LABELS[c]} selected={v.condition === c} onPress={() => set({ condition: c })} style={v.condition === c ? undefined : styles.idle} />
                ))}
              </View>
            </View>

            <Field label="Description (facultatif)" value={v.description} onChangeText={(t) => set({ description: t })} multiline maxLength={2000} counter placeholder="Taille, couleur, défauts éventuels, ce qui est inclus…" />

            <View style={styles.qtyRow}>
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="600">
                  Quantité
                </Text>
                <Text variant="caption" tone="secondary">
                  1 pour un article unique.
                </Text>
              </View>
              <Pressable onPress={() => set({ quantity: Math.max(1, v.quantity - 1) })} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel="Diminuer la quantité">
                <Minus size={18} color={colors.ink} />
              </Pressable>
              <Text variant="headline" style={{ minWidth: 32, textAlign: 'center' }} accessibilityLabel={`Quantité : ${v.quantity}`}>
                {v.quantity}
              </Text>
              <Pressable onPress={() => set({ quantity: Math.min(9999, v.quantity + 1) })} style={styles.qtyBtn} accessibilityRole="button" accessibilityLabel="Augmenter la quantité">
                <Plus size={18} color={colors.ink} />
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <LocationPicker city={v.city} neighborhood={v.neighborhood} onChange={(n) => set({ city: n.city, neighborhood: n.neighborhood })} compact />
            {err(2, 'city') ? <Text variant="caption" tone="danger">{err(2, 'city')}</Text> : null}

            <View style={styles.group}>
              <Text variant="callout" weight="600">
                Remise de l’article
              </Text>
              <View style={styles.wrap}>
                {Object.entries(DELIVERY_LABELS).map(([k, label]) => {
                  const on = v.delivery.includes(k);
                  return <Chip key={k} label={label} selected={on} onPress={() => set({ delivery: on ? v.delivery.filter((x) => x !== k) : [...v.delivery, k] })} style={on ? undefined : styles.idle} />;
                })}
              </View>
              {err(2, 'delivery') ? <Text variant="caption" tone="danger">{err(2, 'delivery')}</Text> : null}
              <Field value={v.deliveryNotes} onChangeText={(t) => set({ deliveryNotes: t })} placeholder="Précision (facultatif) : livraison Dakar 1 000 F, retrait à Sacré-Cœur…" maxLength={300} accessibilityLabel="Précisions sur la remise (facultatif)" />
            </View>

            <Toggle value={v.alsoPost} onChange={(b) => set({ alsoPost: b })} label="Partager aussi dans mon fil" description="Une publication identifie cet article, avec les mêmes photos." />

            <Text variant="caption" tone="secondary">
              Le paiement (espèces, Wave, Orange Money…) se convient directement entre vous. Jëfëli ne détient aucun fonds.
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {step > 0 ? <Button label="Retour" variant="outline" style={{ flex: 1 }} onPress={() => setStep((s) => Math.max(0, s - 1))} /> : null}
        <Button label={last ? 'Publier l’article' : 'Continuer'} variant="cta" style={{ flex: 2 }} onPress={last ? publish : next} />
      </View>
      <UploadOverlay visible={uploading} progress={progress} label="Publication de l’article…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 6 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  more: { backgroundColor: colors.surfaceSubtle },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
});
