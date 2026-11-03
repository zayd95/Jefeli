import { CONDITION_LABELS, formatListingPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { MapPin, Pin, Repeat } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, Text } from '@/design';
import type { ProductCard } from '@/lib/types';

import { Thumb } from './Media';
import { PriceLabel } from './PriceLabel';
import { fill } from '@/design/fill';

const INSET = 5;

/**
 * Grid card (owner's UI reference): a white card with the photo inset and rounded, then the
 * title, a location line with a pin, and the price with a quiet currency. DÉMO sellers stay
 * labelled.
 */
function ListingCardInner({ product, width, showSeller = true, showPinned = false }: { product: ProductCard; width: number; showSeller?: boolean; showPinned?: boolean }) {
  const media = product.media[0];
  const unavailable = product.status === 'sold' || product.status === 'reserved';
  const pinned = showPinned && !!product.pinned_at;
  const imageW = width - INSET * 2;
  const where = product.neighborhood ?? product.city;
  return (
    <Pressable
      onPress={() => router.push(`/p/${product.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${pinned ? 'Épinglé. ' : ''}${product.title}, ${formatListingPrice(product)}`}
    >
      <View>
        <Thumb media={media} style={{ width: imageW, height: Math.round(imageW * 1.08), borderRadius: radius.md }} />
        {unavailable ? (
          <View style={styles.statusOverlay}>
            <Text variant="caption" weight="800" color={colors.white}>
              {product.status === 'sold' ? 'VENDU' : 'RÉSERVÉ'}
            </Text>
          </View>
        ) : null}
        {pinned ? (
          <View style={styles.pinned}>
            <Pin size={11} color={colors.ink} strokeWidth={2.6} />
            <Text variant="micro" weight="700">
              Épinglé
            </Text>
          </View>
        ) : null}
        {product.listing_mode !== 'sale' ? (
          <View style={styles.trade}>
            <Repeat size={11} color={colors.ink} strokeWidth={2.6} />
            <Text variant="micro" weight="700">
              {product.listing_mode === 'trade' ? 'Troc' : 'Vente ou troc'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {product.title}
        </Text>
        <View style={styles.meta}>
          <MapPin size={12} color={colors.textSecondary} strokeWidth={2.2} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[where, product.condition !== 'new' ? CONDITION_LABELS[product.condition] : 'Neuf'].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <PriceLabel product={product} size="card" style={{ marginTop: 4 }} />
        {showSeller && product.seller ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} weight="600">
            {product.seller.display_name}
            {product.seller.is_demo ? ' · DÉMO' : ''}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const ListingCard = memo(ListingCardInner);

/** Two-column grid helper sizes for the current screen width. */
export function gridItemWidth(screenWidth: number, columns = 2, padding = spacing.lg, gap = spacing.md) {
  const usable = Math.min(screenWidth, 720) - padding * 2 - gap * (columns - 1);
  return Math.floor(usable / columns);
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg + INSET, padding: INSET, borderWidth: 1, borderColor: colors.border },
  body: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusOverlay: {
    ...fill,
    backgroundColor: 'rgba(16,37,44,0.45)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinned: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trade: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.action,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
