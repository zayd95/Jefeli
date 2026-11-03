import { CONDITION_LABELS, formatListingPrice, formatXOF, hasDisplayedPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { Pin, Repeat } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, Text } from '@/design';
import type { ProductCard } from '@/lib/types';

import { Thumb } from './Media';
import { fill } from '@/design/fill';

function ListingCardInner({ product, width, showSeller = true, showPinned = false }: { product: ProductCard; width: number; showSeller?: boolean; showPinned?: boolean }) {
  const media = product.media[0];
  const unavailable = product.status === 'sold' || product.status === 'reserved';
  const pinned = showPinned && !!product.pinned_at;
  return (
    <Pressable
      onPress={() => router.push(`/p/${product.id}`)}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${pinned ? 'Épinglé. ' : ''}${product.title}, ${formatListingPrice(product)}`}
    >
      <View>
        <Thumb media={media} style={{ width, height: Math.round(width * 1.15), borderRadius: radius.md }} />
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
      <View style={{ paddingTop: 8, gap: 1 }}>
        {product.price_mode === 'negotiable' && hasDisplayedPrice(product) ? (
          // « 30 000 F · à discuter » fits a narrow grid card; the full label stays in the a11y name.
          <Text variant="bodyStrong" weight="800" numberOfLines={1}>
            {formatXOF(product.price_xof, { compact: true })}
            <Text variant="caption" weight="600" tone="secondary">
              {' · à discuter'}
            </Text>
          </Text>
        ) : (
          <Text variant="bodyStrong" weight="800" numberOfLines={1}>
            {formatListingPrice(product)}
          </Text>
        )}
        <Text variant="callout" numberOfLines={1}>
          {product.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[product.condition !== 'new' ? CONDITION_LABELS[product.condition] : 'Neuf', product.neighborhood ?? product.city].filter(Boolean).join(' · ')}
        </Text>
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
