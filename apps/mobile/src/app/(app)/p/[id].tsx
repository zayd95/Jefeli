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
import { Heart, MapPin, MessageCircle, MoreHorizontal, PackageX, Pin, Repeat, Share2, ShieldCheck, Star, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentMenu } from '@/components/ContentMenu';
import { MediaCarousel } from '@/components/Media';
import { PriceLabel } from '@/components/PriceLabel';
import { ProfileName } from '@/components/ProfileName';
import { Avatar, Button, colors, EmptyState, ErrorState, Header, IconButton, radius, Screen, Skeleton, spacing, Tag, Text, useToast } from '@/design';
import { messageAboutProduct } from '@/lib/api/messages';
import { setPinned } from '@/lib/api/posts';
import { deleteListing, fetchProduct, isProductSaved, setListingStatus, setProductSaved } from '@/lib/api/products';
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
        <Skeleton height={360} radius={0} />
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
  const [busy, setBusy] = useState<string | null>(null);
  const saved = useQuery({ queryKey: ['product-saved', product.id], queryFn: () => isProductSaved(userId ?? '', product.id), enabled: !!userId && !isOwner });
  const seller = product.seller;
  const unavailable = product.status !== 'active';
  const canOffer = !isOwner && product.status === 'active' && product.listing_mode !== 'trade';
  const canTrade = !isOwner && product.status === 'active' && product.listing_mode !== 'sale';
  const mediaW = Math.min(width, 640);

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
      router.push(`/chat/${cid}`);
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

  return (
    <Screen edges={['top']}>
      <Header
        title="Article"
        right={
          <>
            <IconButton icon={Share2} label="Partager l’article" onPress={() => shareLinks.product(product)} />
            {!isOwner ? (
              <IconButton icon={Heart} label={saved.data ? 'Retirer des favoris' : 'Ajouter aux favoris'} filled={!!saved.data} fillColor={colors.danger} color={saved.data ? colors.danger : colors.ink} onPress={toggleSave} />
            ) : null}
            <IconButton icon={MoreHorizontal} label="Plus d’options" onPress={() => setMenu(true)} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ alignItems: 'center' }}>
          <View>
            <MediaCarousel media={product.media} bucket="public-media" width={mediaW} height={Math.round(mediaW * 0.95)} />
            {unavailable ? (
              <View style={styles.statusBanner}>
                <Text variant="callout" weight="800" color={colors.white}>
                  {PRODUCT_STATUS_LABELS[product.status].toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.info}>
          {product.pinned_at ? (
            <View style={styles.pinned}>
              <Pin size={13} color={colors.accentDeep} />
              <Text variant="caption" weight="700" color={colors.accentDeep}>
                Épinglé par le vendeur
              </Text>
            </View>
          ) : null}
          <PriceLabel product={product} size="display" />
          {product.listing_mode === 'trade' && hasDisplayedPrice(product) ? (
            <Text variant="caption" tone="secondary">
              Valeur estimée par le vendeur
            </Text>
          ) : null}
          <Text variant="headline" style={{ marginTop: 2 }}>
            {product.title}
          </Text>
          <View style={styles.tags}>
            <Tag label={CONDITION_LABELS[product.condition]} />
            <Tag label={LISTING_MODE_LABELS[product.listing_mode]} tone={product.listing_mode === 'sale' ? 'neutral' : 'mint'} />
            {product.quantity > 1 ? <Tag label={`${product.quantity} disponibles`} /> : null}
            {unavailable ? <Tag label={PRODUCT_STATUS_LABELS[product.status]} tone="warning" /> : null}
          </View>

          {product.description ? <Text style={{ marginTop: spacing.md }}>{product.description}</Text> : null}

          <View style={styles.detailList}>
            {[
              product.city ? { key: 'where', icon: MapPin, label: [product.neighborhood, product.city].filter(Boolean).join(', '), hint: 'Localisation approximative' } : null,
              { key: 'handover', icon: Truck, label: product.delivery_options.map((d) => DELIVERY_LABELS[d] ?? d).join(' · '), hint: product.delivery_notes || undefined },
              product.listing_mode !== 'sale' ? { key: 'trade', icon: Repeat, label: 'Le vendeur accepte les propositions d’échange', hint: undefined } : null,
            ]
              .filter((d): d is NonNullable<typeof d> => d !== null)
              .map((d, i) => (
                <Detail key={d.key} icon={d.icon} label={d.label} hint={d.hint} first={i === 0} />
              ))}
          </View>
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
            Publié {timeAgo(product.created_at)}
          </Text>
          <View style={styles.shareRow}>
            <Pressable
              onPress={() => whatsappLinks.product(product)}
              style={({ pressed }) => [styles.sharePill, pressed && { backgroundColor: colors.surfaceMuted }]}
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
              style={({ pressed }) => [styles.sharePill, pressed && { backgroundColor: colors.surfaceMuted }]}
              accessibilityRole="button"
              accessibilityLabel="Partager ailleurs (Facebook, Instagram, TikTok…)"
            >
              <Share2 size={16} color={colors.ink} />
              <Text variant="callout" weight="700">
                Partager
              </Text>
            </Pressable>
          </View>
        </View>

        {seller ? (
          <Pressable onPress={() => router.push(`/u/${seller.handle}`)} style={styles.seller} accessibilityRole="button" accessibilityLabel={`Voir la boutique de ${seller.display_name}`}>
            <Avatar path={seller.avatar_path} name={seller.display_name} size={48} />
            <View style={{ flex: 1 }}>
              <ProfileName profile={seller} />
              <Text variant="caption" tone="secondary">
                {[seller.city, seller.products_count ? `${seller.products_count} article${seller.products_count > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}
              </Text>
              {seller.rating_count ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Star size={13} color={colors.ink} fill={colors.ink} />
                  <Text variant="caption" weight="700">
                    {((seller.rating_sum ?? 0) / seller.rating_count).toFixed(1).replace('.', ',')} · {seller.rating_count} avis
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="callout" weight="700">
              Voir sa boutique →
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.safety}>
          <ShieldCheck size={18} color={colors.accentDeep} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {PLATFORM_DISCLAIMER}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isOwner ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {product.status === 'active' ? (
                <>
                  <Button label="Marquer réservé" variant="outline" style={{ flex: 1 }} loading={busy === 'reserved'} onPress={() => changeStatus('reserved')} />
                  <Button label="Marquer vendu" variant="primary" style={{ flex: 1 }} loading={busy === 'sold'} onPress={() => changeStatus('sold')} />
                </>
              ) : (
                <>
                  {product.status === 'reserved' ? <Button label="Marquer vendu" variant="primary" style={{ flex: 1 }} loading={busy === 'sold'} onPress={() => changeStatus('sold')} /> : null}
                  <Button label="Remettre en vente" variant="cta" style={{ flex: 1 }} loading={busy === 'active'} onPress={() => changeStatus('active')} />
                </>
              )}
            </View>
          </View>
        ) : product.status === 'active' ? (
          <View style={{ gap: spacing.sm }}>
            <Button label="Envoyer un message" variant="cta" size="lg" icon={MessageCircle} loading={busy === 'contact'} onPress={contact} />
            {canOffer || canTrade ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {canOffer ? <Button label="Faire une offre" variant="outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'price' } })} /> : null}
                {canTrade ? <Button label="Proposer un troc" variant="outline" accessibilityLabel="Proposer un échange (troc)" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'barter' } })} /> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Button label="Envoyer un message au vendeur" variant="outline" size="lg" icon={MessageCircle} loading={busy === 'contact'} onPress={contact} />
        )}
      </View>

      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={product.seller_id}
        ownerName={seller?.display_name ?? 'ce vendeur'}
        target={{ type: 'product', id: product.id }}
        onShare={() => shareLinks.product(product)}
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
    </Screen>
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
  statusBanner: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,37,44,0.75)', paddingVertical: 10, alignItems: 'center' },
  info: { padding: spacing.lg, gap: 2 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  shareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  detailList: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  detail: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md },
  detailDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  detailIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  safety: { flexDirection: 'row', gap: spacing.sm, margin: spacing.lg, padding: spacing.md, backgroundColor: colors.mintSoft, borderRadius: radius.md },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border },
});
