/**
 * New article on ONE scrolling page (Lovable « Un article, une trouvaille. »): the essentials
 * first — media, title, how it is offered (Vendre / Vendre ou échanger / Wecci seulement), how
 * the price is shown, category, optional description — then « Lieu, état et remise » collapsed
 * with sensible defaults (condition Neuf, the member's city, hand-over), and one sticky
 * « Publier l’article ».
 *
 * Kept from the native composer: the local draft (restored after a crash or a failed upload),
 * upload progress with automatic retry and cancel, create_listing's server rules (a price is
 * required only for « Prix affiché » sales; « Prix sur demande » never stores one), quantity, and
 * the optional feed share — whose failure is now reported instead of being swallowed.
 */
import {
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  DELIVERY_LABELS,
  formatAmountInput,
  isPriceMode,
  parseXOF,
  toFrenchError,
  type ItemCondition,
  type ListingMode,
  type PriceMode,
} from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoicePills, MediaPickerStrip, UploadOverlay } from '@/components/Composer';
import { LocationPicker } from '@/components/LocationPicker';
import { PublishHeader } from '@/components/PublishSwitcher';
import { Button, Chip, colors, Field, radius, Screen, spacing, Text, Toggle, useToast } from '@/design';
import { createPost } from '@/lib/api/posts';
import { createListing, fetchCategories } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/drafts';
import { uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';

const MODES: { key: ListingMode; label: string }[] = [
  { key: 'sale', label: 'Vendre' },
  { key: 'sale_or_trade', label: 'Vendre ou échanger' },
  { key: 'trade', label: 'Wecci seulement' },
];
// Lovable order and short labels; the accessible names keep the full wording.
const PRICES: { key: PriceMode; label: string; a11y: string }[] = [
  { key: 'fixed', label: 'Prix affiché', a11y: 'Prix affiché' },
  { key: 'negotiable', label: 'À discuter', a11y: 'À discuter' },
  { key: 'on_request', label: 'Sur demande', a11y: 'Prix sur demande' },
];
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
  const [allCategories, setAllCategories] = useState(false);
  const [options, setOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });

  const isTrade = v.mode === 'trade';
  const price = parseXOF(v.price);
  // What is sent: no hidden price for « Prix sur demande »; trade listings may carry a value.
  const sentPrice = !isTrade && priceMode === 'on_request' ? null : price && price > 0 ? price : null;
  const errors = {
    media: v.media.length === 0 ? 'Ajoutez au moins une photo ou une vidéo.' : null,
    title: v.title.trim().length < 3 ? 'Donnez un titre (3 caractères minimum).' : null,
    price: !isTrade && priceMode === 'fixed' && !sentPrice ? 'Indiquez un prix, ou choisissez « Prix sur demande » ou « À discuter ».' : null,
    category: !v.category ? 'Choisissez une catégorie.' : null,
    city: !v.city.trim() ? 'Indiquez une ville.' : null,
    delivery: v.delivery.length === 0 ? 'Choisissez au moins un mode de remise.' : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);
  const valid = Object.values(errors).every((e) => !e);

  async function publish() {
    if (!valid) {
      setShowErrors(true);
      // Errors in the collapsed options open them, so nothing invalid stays hidden.
      if (errors.city || errors.delivery) setOptions(true);
      if (errors.media || errors.title || errors.price) scroll.current?.scrollTo({ y: 0, animated: true });
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
      let shared = true;
      if (v.alsoPost) {
        // Same files, no second upload: also share it in the social feed, tagged.
        shared = await createPost({ body: v.title.trim(), visibility: 'public', media: uploaded, productIds: [id] })
          .then(() => true)
          .catch(() => false);
      }
      await draft.clear();
      qc.invalidateQueries({ queryKey: ['seller-products', userId] });
      qc.invalidateQueries({ queryKey: ['my-active-products', userId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['explore'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      // Partial failure is said plainly: the article exists, the feed share did not go out.
      if (shared) toast('Article publié dans votre boutique', 'success');
      else toast('Article publié dans votre boutique, mais le partage dans votre fil a échoué. Vous pourrez le partager depuis une publication.', 'error');
      router.replace(`/p/${id}`);
    } catch (e) {
      // The draft is kept: nothing typed or picked is lost; publishing again retries.
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  const cats = categories.data ?? [];
  const selectedCategory = cats.find((c) => c.slug === v.category);
  const visibleCats = allCategories ? cats : cats.slice(0, FEATURED_CATEGORIES).concat(selectedCategory && cats.indexOf(selectedCategory) >= FEATURED_CATEGORIES ? [selectedCategory] : []);
  const summary = [CONDITION_LABELS[v.condition], v.city || 'Ville ?', v.delivery.map((d) => DELIVERY_LABELS[d] ?? d).join(', ') || 'Remise ?'].join(' · ');

  return (
    <Screen edges={['top']} keyboard>
      <PublishHeader mode="listing" />
      <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View>
          <Text serif weight="600" style={styles.headline}>
            Un article, une trouvaille.
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 4, fontSize: 13 }}>
            Les essentiels, puis on publie. Le reste est facultatif.
          </Text>
          {draft.restored ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
              Brouillon restauré.{' '}
              <Text variant="caption" tone="accent" weight="700" onPress={() => draft.clear()}>
                Recommencer
              </Text>
            </Text>
          ) : null}
        </View>

        <View>
          <MediaPickerStrip media={v.media} onChange={(m) => set({ media: m })} required label="Photo ou vidéo" />
          {err('media') ? <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>{err('media')}</Text> : null}
        </View>

        <Field
          label="Titre de l’article"
          accessibilityLabel="Titre"
          value={v.title}
          onChangeText={(t) => set({ title: t })}
          placeholder="Ex. Sac en cuir fait main"
          maxLength={80}
          counter
          error={err('title')}
        />

        <View style={styles.group}>
          <Text variant="callout" weight="600" style={styles.label}>
            Comment souhaitez-vous le proposer ?
          </Text>
          <ChoicePills<ListingMode> value={v.mode} onChange={(m) => set({ mode: m })} options={MODES} />
        </View>

        {isTrade ? (
          <View style={styles.group}>
            <Text variant="caption" style={styles.tradeNote}>
              Échange uniquement (Wecci) : aucun prix nécessaire.
            </Text>
            <Field
              label="Valeur estimée (facultatif)"
              value={v.price}
              onChangeText={(t) => set({ price: formatAmountInput(t) })}
              keyboardType="number-pad"
              placeholder="Aide à équilibrer un troc"
              suffix="F CFA"
            />
          </View>
        ) : (
          <View style={styles.group}>
            <Text variant="callout" weight="600" style={styles.label}>
              Prix
            </Text>
            <ChoicePills<PriceMode> value={priceMode} onChange={(m) => set({ priceMode: m })} options={PRICES} />
            {priceMode === 'on_request' ? (
              <Text variant="caption" tone="secondary">
                Les acheteurs vous écrivent pour connaître le prix. Aucun prix n’est affiché.
              </Text>
            ) : (
              <Field
                value={v.price}
                onChangeText={(t) => set({ price: formatAmountInput(t) })}
                keyboardType="number-pad"
                placeholder={priceMode === 'fixed' ? 'Prix en F CFA' : 'Prix indicatif en F CFA (facultatif)'}
                suffix="F CFA"
                accessibilityLabel={priceMode === 'fixed' ? 'Prix' : 'Prix de départ (facultatif)'}
                error={err('price')}
                hint={priceMode === 'negotiable' ? 'Indiquez un prix de départ si vous le souhaitez.' : undefined}
              />
            )}
          </View>
        )}

        <View style={styles.group}>
          <Text variant="callout" weight="600" style={styles.label}>
            Catégorie
          </Text>
          <View style={styles.wrap}>
            {visibleCats.map((c) => (
              <Chip key={c.slug} label={c.name} selected={v.category === c.slug} onPress={() => set({ category: c.slug })} style={v.category === c.slug ? styles.chipOn : styles.idle} />
            ))}
            {cats.length > FEATURED_CATEGORIES ? (
              <Chip label={allCategories ? 'Moins' : `Voir tout (${cats.length})`} onPress={() => setAllCategories((x) => !x)} style={styles.more} />
            ) : null}
          </View>
          {err('category') ? <Text variant="caption" tone="danger">{err('category')}</Text> : null}
        </View>

        <Field
          label="Description (facultatif)"
          value={v.description}
          onChangeText={(t) => set({ description: t })}
          multiline
          maxLength={2000}
          counter
          placeholder="Taille, état, détails utiles…"
        />

        {/* Progressive disclosure: location, condition and hand-over, with visible defaults. */}
        <View style={styles.options}>
          <Pressable
            onPress={() => setOptions((x) => !x)}
            style={styles.optionsHead}
            accessibilityRole="button"
            aria-expanded={options}
            accessibilityState={{ expanded: options }}
            accessibilityLabel={`Lieu, état et remise, options. ${summary}`}
          >
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="600" style={styles.label}>
                Lieu, état et remise
                <Text variant="callout" tone="secondary" weight="400" style={{ fontSize: 13 }}>
                  {' · options'}
                </Text>
              </Text>
              {!options ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {summary}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={18} color={colors.textSecondary} style={options ? { transform: [{ rotate: '90deg' }] } : undefined} />
          </Pressable>
          {options ? (
            <View style={{ gap: spacing.xl, paddingTop: spacing.lg }}>
              <View style={styles.group}>
                <Text variant="callout" weight="600" style={styles.label}>
                  État
                </Text>
                <View style={styles.wrap}>
                  {CONDITION_OPTIONS.map((c) => (
                    <Chip key={c} label={CONDITION_LABELS[c]} selected={v.condition === c} onPress={() => set({ condition: c })} style={v.condition === c ? styles.chipOn : styles.idle} />
                  ))}
                </View>
              </View>

              <LocationPicker city={v.city} neighborhood={v.neighborhood} onChange={(n) => set({ city: n.city, neighborhood: n.neighborhood })} compact />
              {err('city') ? <Text variant="caption" tone="danger">{err('city')}</Text> : null}

              <View style={styles.group}>
                <Text variant="callout" weight="600" style={styles.label}>
                  Remise
                </Text>
                <View style={styles.wrap}>
                  {Object.entries(DELIVERY_LABELS).map(([k, label]) => {
                    const on = v.delivery.includes(k);
                    return <Chip key={k} label={label} selected={on} onPress={() => set({ delivery: on ? v.delivery.filter((x) => x !== k) : [...v.delivery, k] })} style={on ? styles.chipOn : styles.idle} />;
                  })}
                </View>
                {err('delivery') ? <Text variant="caption" tone="danger">{err('delivery')}</Text> : null}
                <Field value={v.deliveryNotes} onChangeText={(t) => set({ deliveryNotes: t })} placeholder="Précision (facultatif) : livraison Dakar 1 000 F, retrait à Sacré-Cœur…" maxLength={300} accessibilityLabel="Précisions sur la remise (facultatif)" />
              </View>

              <View style={styles.qtyRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="callout" weight="600" style={styles.label}>
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
            </View>
          ) : null}
        </View>

        <Toggle value={v.alsoPost} onChange={(b) => set({ alsoPost: b })} label="Partager aussi dans mon fil" description="Une publication identifie cet article, avec les mêmes photos." />

        <Text variant="caption" tone="secondary">
          Le paiement (espèces, Wave, Orange Money…) se convient directement entre vous. Jëfëli ne détient aucun fonds.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button label="Publier l’article" variant="cta" size="lg" pill fullWidth onPress={publish} style={{ height: 56 }} />
      </View>
      <UploadOverlay visible={uploading} progress={progress} label="Publication de l’article…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingTop: spacing.xl, gap: 20, paddingBottom: spacing.xxl },
  headline: { fontSize: 28, lineHeight: 33, color: colors.ink },
  group: { gap: spacing.sm },
  label: { fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 40 },
  chipOn: { backgroundColor: colors.night, height: 40 },
  more: { backgroundColor: colors.surfaceSubtle, height: 40 },
  tradeNote: { backgroundColor: colors.mintSoft, color: colors.ink, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 12 },
  options: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  optionsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.glassLight, borderTopWidth: 1, borderTopColor: colors.border },
});
