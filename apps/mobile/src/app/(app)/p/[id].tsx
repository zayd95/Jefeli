import {
  CONDITION_LABELS,
  DELIVERY_LABELS,
  hasDisplayedPrice,
  LISTING_MODE_LABELS,
  PLATFORM_DISCLAIMER,
  PRODUCT_STATUS_LABELS,
  timeAgo,
  toFrenchError,
} from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Heart, MapPin, MessageCircle, Mic, MoreHorizontal, PackageX, Pin, Repeat, Share2, ShieldCheck, Star, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentMenu } from '@/components/ContentMenu';
import { MediaCarousel } from '@/components/Media';
import { PriceLabel } from '@/components/PriceLabel';
import { ShareToStatusSheet } from '@/components/ShareToStatus';
import { ProfileName } from '@/components/ProfileName';
import { Avatar, Button, colors, dark, EmptyState, ErrorState, Header, IconButton, radius, Screen, shadow, Skeleton, spacing, Text, useToast } from '@/design';
import { messageAboutProduct } from '@/lib/api/messages';
import { setPinned } from '@/lib/api/posts';
import { deleteListing, fetchCategories, fetchProduct, isProductSaved, setListingStatus, setProductSaved } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { shareLinks, whatsappLinks } from '@/lib/share';
import type { ProductCard } from '@/lib/types';
import { goBack } from '@/lib/nav';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id ?? '') });

  if (q.isPending) {
    return (
      <Screen>
        <Header title="Article" />
        <Skeleton height={340} radius={0} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={28} width="45%" />
          <Skeleton height={18} width="70%" />
        </View>
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <Header title="Article" />
        <ErrorState message={toFrenchError(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  if (!q.data) {
    return (
      <Screen>
        <Header title="Article" />
        <EmptyState icon={PackageX} title="Article indisponible" body="Il a peut-être été retiré, archivé par son vendeur ou masqué par la modération." />
      </Screen>
    );
  }
  return <ProductDetail product={q.data} isOwner={q.data.seller_id === userId} />;
}

function ProductDetail({ product, isOwner }: { product: ProductCard; isOwner: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ctaHeight, setCtaHeight] = useState(140);
  const saved = useQuery({ queryKey: ['product-saved', product.id], queryFn: () => isProductSaved(userId ?? '', product.id), enabled: !!userId && !isOwner });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const category = categories.data?.find((c) => c.slug === product.category_slug);
  const seller = product.seller;
  const unavailable = product.status !== 'active';
  const canOffer = !isOwner && product.status === 'active' && product.listing_mode !== 'trade';
  const canTrade = !isOwner && product.status === 'active' && product.listing_mode !== 'sale';
  const mediaW = Math.min(width, 640);
  const wecci = product.listing_mode !== 'sale';

  async function toggleSave() {
    const next = !saved.data;
    qc.setQueryData(['product-saved', product.id], next);
    try {
      await setProductSaved(userId ?? '', product.id, next);
      toast(next ? 'Ajouté à vos favoris' : 'Retiré des favoris', 'success');
      qc.invalidateQueries({ queryKey: ['saved-products'] });
    } catch (e) {
      qc.setQueryData(['product-saved', product.id], !next);
      toast(toFrenchError(e), 'error');
    }
  }

  async function contact() {
    setBusy('contact');
    try {
      const cid = await messageAboutProduct(product.id);
      router.push(`/chat/${cid}?about=${product.id}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: 'active' | 'reserved' | 'sold' | 'archived') {
    setBusy(status);
    try {
      await setListingStatus(product.id, status);
      qc.invalidateQueries({ queryKey: ['product', product.id] });
      qc.invalidateQueries({ queryKey: ['seller-products', product.seller_id] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast(status === 'active' ? 'Remis en vente' : `Marqué « ${PRODUCT_STATUS_LABELS[status]} »`, 'success');
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const offer = () => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'price' } });
  const barter = () => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'barter' } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: ctaHeight + spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* Image-led, full-bleed (Lovable aspect-square) with glass controls over the photo. */}
        <View style={{ alignItems: 'center', backgroundColor: colors.night }}>
          <View>
            <MediaCarousel media={product.media} bucket="public-media" width={mediaW} height={mediaW} />
            {unavailable ? (
              <View style={styles.statusBanner}>
                <Text variant="callout" weight="800" color={colors.white}>
                  {PRODUCT_STATUS_LABELS[product.status].toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.tags}>
            <Chip label={CONDITION_LABELS[product.condition]} />
            {category ? <Chip label={category.name} /> : null}
            <Chip label={LISTING_MODE_LABELS[product.listing_mode]} wecci={wecci} />
            {product.quantity > 1 ? <Chip label={`${product.quantity} disponibles`} /> : null}
            {unavailable ? <Chip label={PRODUCT_STATUS_LABELS[product.status]} warning /> : null}
          </View>
          {product.pinned_at ? (
            <View style={styles.pinned}>
              <Pin size={13} color={colors.accentDeep} />
              <Text variant="caption" weight="700" color={colors.accentDeep}>
                Épinglé par le vendeur
              </Text>
            </View>
          ) : null}
          <Text serif weight="600" accessibilityRole="header" style={styles.title}>
            {product.title}
          </Text>
          <PriceLabel product={product} size="display" />
          {product.listing_mode === 'trade' && hasDisplayedPrice(product) ? (
            <Text variant="caption" tone="secondary">
              Valeur estimée par le vendeur
            </Text>
          ) : null}

          {seller ? (
            <Pressable
              onPress={() => router.push(`/u/${seller.handle}`)}
              style={({ pressed }) => [styles.seller, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`Voir la boutique de ${seller.display_name}`}
            >
              <Avatar path={seller.avatar_path} name={seller.display_name} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <ProfileName profile={seller} />
                {seller.city ? (
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {seller.city}
                  </Text>
                ) : null}
                {seller.rating_count ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Star size={13} color={colors.ink} fill={colors.ink} />
                    <Text variant="caption" weight="700">
                      {((seller.rating_sum ?? 0) / seller.rating_count).toFixed(1).replace('.', ',')} · {seller.rating_count} avis
                    </Text>
                  </View>
                ) : null}
              </View>
              <ArrowRight size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}

          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}

          <View style={styles.detailList}>
            {[
              product.city ? { key: 'where', icon: MapPin, label: [product.neighborhood, product.city].filter(Boolean).join(', '), hint: 'Localisation approximative' } : null,
              { key: 'handover', icon: Truck, label: product.delivery_options.map((d) => DELIVERY_LABELS[d] ?? d).join(' · '), hint: product.delivery_notes || undefined },
              wecci ? { key: 'trade', icon: Repeat, label: 'Wecci : le vendeur accepte les propositions d’échange', hint: undefined } : null,
            ]
              .filter((d): d is NonNullable<typeof d> => d !== null)
              .map((d, i) => (
                <Detail key={d.key} icon={d.icon} label={d.label} hint={d.hint} first={i === 0} />
              ))}
          </View>

          <View style={styles.shareRow}>
            <Pressable
              onPress={() => whatsappLinks.product(product)}
              style={({ pressed }) => [styles.sharePill, pressed && { backgroundColor: colors.surfaceSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Partager sur WhatsApp"
            >
              <MessageCircle size={16} color={colors.ink} />
              <Text variant="callout" weight="700">
                WhatsApp
              </Text>
            </Pressable>
            <Pressable
              onPress={() => shareLinks.product(product)}
              style={({ pressed }) => [styles.sharePill, pressed && { backgroundColor: colors.surfaceSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Partager ailleurs (Facebook, Instagram, TikTok…)"
            >
              <Share2 size={16} color={colors.ink} />
              <Text variant="callout" weight="700">
                Partager
              </Text>
            </Pressable>
            <Text variant="caption" tone="secondary" style={{ marginLeft: 'auto' }}>
              Publié {timeAgo(product.created_at)}
            </Text>
          </View>

          {/* No Jëfëli-held payment: the members settle it between themselves. */}
          <View style={styles.safety}>
            <ShieldCheck size={16} color={colors.textSecondary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1, lineHeight: 18 }}>
              Le paiement se règle directement entre vous (Wave, Orange Money, espèces…). {PLATFORM_DISCLAIMER}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]} pointerEvents="box-none">
        <IconButton icon={ArrowLeft} label="Retour" variant="glass" size={20} color={dark.text} onPress={() => goBack()} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton icon={Share2} label="Partager l’article" variant="glass" size={19} color={dark.text} onPress={() => shareLinks.product(product)} />
          {!isOwner ? (
            <IconButton icon={Heart} label={saved.data ? 'Retirer des favoris' : 'Ajouter aux favoris'} variant="glass" size={19} filled={!!saved.data} fillColor={colors.danger} color={saved.data ? colors.danger : dark.text} onPress={toggleSave} />
          ) : null}
          <IconButton icon={MoreHorizontal} label="Plus d’options" variant="glass" size={19} color={dark.text} onPress={() => setMenu(true)} />
        </View>
      </View>

      {/* Sticky Lovable CTA: a light glass bar with the main action in ink. */}
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}>
        <View style={[styles.cta, shadow.floating]}>
          {isOwner ? (
            <View style={{ gap: 8 }}>
              {product.status === 'active' ? (
                // W1.2: show it in photos and in your own voice, the article attached.
                <Button label="Présenter cet article" variant="soft" icon={Mic} accessibilityLabel="Présenter cet article en photos et en voix" onPress={() => router.push(`/publish/post?product=${product.id}`)} />
              ) : null}
            <View style={styles.ctaRow}>
              {product.status === 'active' ? (
                <>
                  <Button label="Marquer réservé" variant="outline" style={styles.ctaSecondary} loading={busy === 'reserved'} onPress={() => changeStatus('reserved')} />
                  <Button label="Marquer vendu" variant="primary" size="lg" style={styles.ctaPrimary} loading={busy === 'sold'} onPress={() => changeStatus('sold')} />
                </>
              ) : (
                <>
                  {product.status === 'reserved' ? <Button label="Marquer vendu" variant="primary" size="lg" style={styles.ctaPrimary} loading={busy === 'sold'} onPress={() => changeStatus('sold')} /> : null}
                  <Button label="Remettre en vente" variant="cta" size="lg" style={styles.ctaPrimary} loading={busy === 'active'} onPress={() => changeStatus('active')} />
                </>
              )}
            </View>
            </View>
          ) : product.status === 'active' ? (
            <View style={{ gap: 8 }}>
              <View style={styles.ctaRow}>
                <Button label="Envoyer un message" variant="primary" size="lg" icon={MessageCircle} loading={busy === 'contact'} onPress={contact} style={styles.ctaPrimary} />
                {canOffer && !canTrade ? <Button label="Faire une offre" variant="outline" size="lg" style={styles.ctaSecondary} onPress={offer} /> : null}
                {canTrade && !canOffer ? <Button label="Proposer un troc" variant="outline" size="lg" accessibilityLabel="Proposer un échange (troc)" style={styles.ctaSecondary} onPress={barter} /> : null}
              </View>
              {canOffer && canTrade ? (
                <View style={styles.ctaRow}>
                  <Button label="Faire une offre" variant="outline" style={styles.ctaHalf} onPress={offer} />
                  <Button label="Proposer un troc" variant="outline" accessibilityLabel="Proposer un échange (troc)" style={styles.ctaHalf} onPress={barter} />
                </View>
              ) : null}
            </View>
          ) : (
            <Button label="Envoyer un message au vendeur" variant="outline" size="lg" icon={MessageCircle} loading={busy === 'contact'} onPress={contact} style={{ borderRadius: 18 }} />
          )}
        </View>
      </View>

      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={product.seller_id}
        ownerName={seller?.display_name ?? 'ce vendeur'}
        target={{ type: 'product', id: product.id }}
        onShare={() => shareLinks.product(product)}
        onShareToStatus={product.status === 'active' || product.status === 'reserved' ? () => setStatusSheet(true) : undefined}
        pin={{
          pinned: !!product.pinned_at,
          onToggle: async () => {
            try {
              await setPinned('product', product.id, !product.pinned_at);
              qc.invalidateQueries({ queryKey: ['product', product.id] });
              qc.invalidateQueries({ queryKey: ['seller-products', product.seller_id] });
              toast(product.pinned_at ? 'Retiré de votre profil' : 'Épinglé sur votre profil', 'success');
            } catch (e) {
              toast(toFrenchError(e), 'error');
            }
          },
        }}
        onEdit={() => router.push(`/listing-edit/${product.id}`)}
        deleteLabel="Supprimer l’article"
        onDelete={async () => {
          await deleteListing(product.id);
          qc.invalidateQueries({ queryKey: ['seller-products', product.seller_id] });
          qc.invalidateQueries({ queryKey: ['me'] });
          goBack();
        }}
      />
      <ShareToStatusSheet visible={statusSheet} onClose={() => setStatusSheet(false)} target={{ productId: product.id }} />
    </View>
  );
}

/** Lovable product chip: paper with a hairline; Wecci in night with a gold label. */
function Chip({ label, wecci, warning }: { label: string; wecci?: boolean; warning?: boolean }) {
  return (
    <View style={[styles.chip, wecci && styles.chipWecci, warning && styles.chipWarning]}>
      {wecci ? <Repeat size={11} color={colors.gold} strokeWidth={2.6} /> : null}
      <Text variant="caption" weight={wecci ? '700' : '600'} color={wecci ? colors.gold : warning ? colors.warning : colors.textSecondary} style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

/** One row of the grouped detail list: a round icon bubble, the value and an optional hint. */
function Detail({ icon: Icon, label, hint, first }: { icon: typeof MapPin; label: string; hint?: string; first?: boolean }) {
  return (
    <View style={[styles.detail, !first && styles.detailDivider]}>
      <View style={styles.detailIcon}>
        <Icon size={17} color={colors.ink} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  statusBanner: { position: 'absolute', left: 0, right: 0, bottom: 24, backgroundColor: dark.scrim, paddingVertical: 10, alignItems: 'center' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  // Lovable: rounded near-white sheet overlapping the photo by 24 pt.
  sheet: { marginTop: -24, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipWecci: { backgroundColor: colors.night, borderColor: colors.night },
  chipWarning: { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  title: { marginTop: spacing.md, fontSize: 28, lineHeight: 33, color: colors.ink },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 20, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  description: { marginTop: 20, fontSize: 15, lineHeight: 24, color: colors.inkSoft },
  detailList: { marginTop: 20, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  detail: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md },
  detailDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  detailIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  sharePill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  safety: { flexDirection: 'row', gap: spacing.sm, marginTop: 20, padding: spacing.md, backgroundColor: colors.inkWash, borderRadius: 16 },
  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  cta: { maxWidth: 520, width: '100%', alignSelf: 'center', padding: 8, borderRadius: radius.xxl, backgroundColor: colors.glassLight, borderWidth: 1, borderColor: colors.border },
  ctaRow: { flexDirection: 'row', gap: 8 },
  ctaPrimary: { flex: 1, borderRadius: 18 },
  ctaSecondary: { borderRadius: 18, backgroundColor: colors.surface },
  ctaHalf: { flex: 1, borderRadius: 18, backgroundColor: colors.surface },
});
