import { CONDITION_LABELS, formatListingPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { MapPin, Pin, Repeat } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, colors, dark, DemoBadge, light, shadow, spacing, Text, VerifiedBadge } from '@/design';
import { fill } from '@/design/fill';
import type { ProductCard } from '@/lib/types';

import { Thumb } from './Media';
import { PriceLabel } from './PriceLabel';
import { SaveHeart } from './SaveHeart';

const INSET = 5;

/**
 * Product card (« Dakar after dark »): full-bleed photo (≈ 4:5 on phones, 4:4.6 on wider grids), a
 * status badge top-left (Neuf, état, Wecci, Épinglé), the real favourite heart top-right, then the
 * seller, the serif title, place · condition, a thin divider and the price. DÉMO sellers stay
 * labelled; the verified mark only for real merchant verification. `big` is Explorer's lead card;
 * `tone="dark"` is the compact boutique tile on the profile grid.
 */
function ListingCardInner({
  product,
  width,
  showSeller = true,
  showPinned = false,
  big = false,
  tone = 'light',
  showVerified = false,
  surface = 'dark',
}: {
  product: ProductCard;
  width: number;
  showSeller?: boolean;
  showPinned?: boolean;
  big?: boolean;
  tone?: 'light' | 'dark';
  /** 'paper': white card for the white Explorer page. */
  surface?: 'dark' | 'paper';
  /** Desktop grid (W1.4): seller line with the verified mark, only for real merchant verification. */
  showVerified?: boolean;
}) {
  const isDark = tone === 'dark';
  if (isDark) return <BoutiqueTile product={product} width={width} showPinned={showPinned} />;
  const media = product.media[0];
  const unavailable = product.status === 'sold' || product.status === 'reserved';
  const pinned = showPinned && !!product.pinned_at;
  const roomy = width >= 220; // desktop / tablet grid: larger radius and padding
  const imageH = Math.round(big ? (width * 11) / 16 : roomy ? width * 1.15 : width * 1.25);
  const where = product.neighborhood ?? product.city;
  const badge = pinned
    ? 'ÉPINGLÉ'
    : product.listing_mode === 'trade'
      ? 'WECCI'
      : product.listing_mode !== 'sale'
        ? 'VENTE OU WECCI'
        : product.condition === 'new'
          ? 'NEUF'
          : CONDITION_LABELS[product.condition].toUpperCase();
  const radiusCard = roomy || big ? 20 : 16;
  const paper = surface === 'paper';
  const ink = paper ? light.ink : colors.ink;
  // The heart sits beside the card's link (not inside it): two separate buttons.
  return (
    <View style={{ width }}>
      <Pressable
        testID="listing-card"
        onPress={() => router.push(`/p/${product.id}`)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.card,
          paper && styles.cardPaper,
          { width, borderRadius: radiusCard },
          hovered && roomy && { transform: [{ translateY: -4 }] },
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${pinned ? 'Épinglé. ' : ''}${product.title}, ${formatListingPrice(product)}`}
      >
        <View>
          <Thumb media={media} style={{ width, height: imageH, backgroundColor: paper ? light.surfaceMuted : colors.surfaceMuted }} />
          {unavailable ? (
            <View style={styles.statusOverlay}>
              <Text variant="caption" weight="800" color={colors.white}>
                {product.status === 'sold' ? 'VENDU' : 'RÉSERVÉ'}
              </Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            {pinned ? (
              <Pin size={10} color={colors.onPrimary} strokeWidth={2.6} />
            ) : product.listing_mode !== 'sale' ? (
              <Repeat size={10} color={colors.onPrimary} strokeWidth={2.6} />
            ) : null}
            <Text weight="700" color={colors.onPrimary} style={{ fontSize: 10.5, lineHeight: 13, letterSpacing: 0.6 }}>
              {badge}
            </Text>
          </View>
        </View>
        <View style={[styles.body, roomy && { padding: 15 }]}>
          {showSeller && product.seller ? (
            <View style={styles.seller}>
              <Avatar path={product.seller.avatar_path} name={product.seller.display_name} size={18} />
              <Text variant="caption" weight="600" color={paper ? light.textSecondary : colors.textSecondary} numberOfLines={1} style={{ fontSize: 11.5, flexShrink: 1 }}>
                {product.seller.display_name}
              </Text>
              {product.seller.verification_level === 'merchant_verified' ? <VerifiedBadge size={13} /> : null}
              {product.seller.is_demo ? <DemoBadge tone={paper ? 'paper' : 'dark'} /> : null}
            </View>
          ) : null}
          <Text serif color={ink} numberOfLines={2} style={big || roomy ? { fontSize: 22, lineHeight: 26 } : { fontSize: 18, lineHeight: 22 }}>
            {product.title}
          </Text>
          <View style={styles.meta}>
            <MapPin size={12} color={paper ? light.accent : colors.mintAccent} strokeWidth={2.2} />
            <Text variant="caption" color={paper ? light.textTertiary : colors.textTertiary} numberOfLines={1} style={{ flexShrink: 1, fontSize: 12 }}>
              {[where, product.condition !== 'new' ? CONDITION_LABELS[product.condition] : 'Neuf'].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[styles.divider, paper && { backgroundColor: light.border }]} />
          <PriceLabel product={product} size="card" tone={paper ? 'paper' : 'dark'} />
        </View>
      </Pressable>
      <View style={styles.heart}>
        <SaveHeart productId={product.id} sellerId={product.seller?.id ?? product.seller_id} title={product.title} />
      </View>
    </View>
  );
}

/** Boutique tile on the member profile grid: compact dark card, photo inset, title and price. */
function BoutiqueTile({ product, width, showPinned }: { product: ProductCard; width: number; showPinned: boolean }) {
  const media = product.media[0];
  const unavailable = product.status === 'sold' || product.status === 'reserved';
  const pinned = showPinned && !!product.pinned_at;
  const imageW = width - INSET * 2;
  const imageH = Math.round((imageW * 4) / 5);
  return (
    <Pressable
      testID="listing-card"
      onPress={() => router.push(`/p/${product.id}`)}
      style={({ pressed }) => [styles.tile, { width }, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${pinned ? 'Épinglé. ' : ''}${product.title}, ${formatListingPrice(product)}`}
    >
      <View>
        <Thumb media={media} style={{ width: imageW, height: imageH, borderRadius: 12, backgroundColor: dark.raised }} />
        {unavailable ? (
          <View style={[styles.statusOverlay, { borderRadius: 12 }]}>
            <Text variant="caption" weight="800" color={colors.white}>
              {product.status === 'sold' ? 'VENDU' : 'RÉSERVÉ'}
            </Text>
          </View>
        ) : null}
        {pinned ? (
          <View style={[styles.badge, { left: 6, top: 6 }]}>
            <Pin size={10} color={colors.onPrimary} strokeWidth={2.6} />
            <Text weight="700" color={colors.onPrimary} style={{ fontSize: 10, lineHeight: 13 }}>
              ÉPINGLÉ
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 6, paddingTop: 8, paddingBottom: 6, gap: 4 }}>
        <Text serif color={dark.text} numberOfLines={1} style={{ fontSize: 15, lineHeight: 19 }}>
          {product.title}
        </Text>
        <PriceLabel product={product} size="card" compact tone="dark" />
      </View>
    </Pressable>
  );
}

export const ListingCard = memo(ListingCardInner);

/** Two-column grid helper sizes for the current screen width. */
export function gridItemWidth(screenWidth: number, columns = 2, padding: number = spacing.lg, gap: number = spacing.md) {
  const usable = Math.min(screenWidth, 720) - padding * 2 - gap * (columns - 1);
  return Math.floor(usable / columns);
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.paper },
  cardPaper: { backgroundColor: light.surface, borderColor: light.border },
  tile: { padding: INSET, backgroundColor: dark.surface, borderRadius: 16, borderWidth: 1, borderColor: dark.border },
  body: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 13, gap: 6 },
  seller: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  statusOverlay: { ...fill, backgroundColor: dark.scrimSoft, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(246, 245, 237, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  heart: { position: 'absolute', right: 10, top: 10 },
});
