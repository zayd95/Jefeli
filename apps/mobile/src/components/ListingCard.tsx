import { CONDITION_LABELS, formatListingPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { MapPin, Pin, Repeat } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, radius, shadow, spacing, Text } from '@/design';
import { fill } from '@/design/fill';
import type { ProductCard } from '@/lib/types';

import { Thumb } from './Media';
import { PriceLabel } from './PriceLabel';

const INSET = 5;

/**
 * Lovable ProductCard: a paper card with the photo inset by 5 pt (radius 15), a « Wecci » badge
 * for articles open to exchange, then the title, a pin + place line and the PriceLine. DÉMO
 * sellers stay labelled. `big` is Explorer's lead card (16:11 photo, serif title); `tone="dark"`
 * is the boutique tile on the Atlantic-night profile.
 */
function ListingCardInner({
  product,
  width,
  showSeller = true,
  showPinned = false,
  big = false,
  tone = 'light',
}: {
  product: ProductCard;
  width: number;
  showSeller?: boolean;
  showPinned?: boolean;
  big?: boolean;
  tone?: 'light' | 'dark';
}) {
  const isDark = tone === 'dark';
  const media = product.media[0];
  const unavailable = product.status === 'sold' || product.status === 'reserved';
  const pinned = showPinned && !!product.pinned_at;
  const imageW = width - INSET * 2;
  const imageH = Math.round(big ? (imageW * 11) / 16 : isDark ? (imageW * 4) / 5 : imageW * 1.2);
  const where = product.neighborhood ?? product.city;
  const wecci = product.listing_mode !== 'sale';
  return (
    <Pressable
      onPress={() => router.push(`/p/${product.id}`)}
      style={({ pressed }) => [styles.card, isDark ? styles.cardDark : styles.cardLight, { width }, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${pinned ? 'Épinglé. ' : ''}${product.title}, ${formatListingPrice(product)}`}
    >
      <View>
        <Thumb media={media} style={{ width: imageW, height: imageH, borderRadius: isDark ? 13 : 15, backgroundColor: isDark ? dark.raised : colors.surfaceMuted }} />
        {unavailable ? (
          <View style={[styles.statusOverlay, { borderRadius: isDark ? 13 : 15 }]}>
            <Text variant="caption" weight="800" color={colors.white}>
              {product.status === 'sold' ? 'VENDU' : 'RÉSERVÉ'}
            </Text>
          </View>
        ) : null}
        <View style={styles.badges}>
          {pinned ? (
            <View style={styles.badgePaper}>
              <Pin size={10} color={colors.ink} strokeWidth={2.6} />
              <Text variant="micro" weight="700" style={{ fontSize: 10 }}>
                Épinglé
              </Text>
            </View>
          ) : null}
          {wecci ? (
            <View style={styles.badgeWecci}>
              <Repeat size={10} color={colors.gold} strokeWidth={2.6} />
              <Text variant="micro" weight="700" color={colors.gold} style={{ fontSize: 10 }}>
                {product.listing_mode === 'trade' ? 'Wecci' : 'Vente ou Wecci'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.body, big && { paddingTop: 12 }]}>
        <Text
          serif={big}
          weight={big ? '600' : '600'}
          color={isDark ? dark.text : colors.ink}
          numberOfLines={big ? 2 : isDark ? 1 : 2}
          style={big ? { fontSize: 21, lineHeight: 26 } : { fontSize: isDark ? 13 : 14, lineHeight: 18 }}
        >
          {product.title}
        </Text>
        {!isDark ? (
          <View style={styles.meta}>
            <MapPin size={12} color={colors.textSecondary} strokeWidth={2.2} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1, fontSize: 12 }}>
              {[where, product.condition !== 'new' ? CONDITION_LABELS[product.condition] : 'Neuf'].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
        <View style={{ marginTop: 6 }}>
          <PriceLabel product={product} size="card" compact={isDark} tone={tone} />
        </View>
        {showSeller && product.seller ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} weight="600" style={{ marginTop: 2, fontSize: 11.5 }}>
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
  card: { padding: INSET },
  cardLight: { backgroundColor: colors.surface, borderRadius: 20, ...shadow.paper },
  cardDark: { backgroundColor: dark.surface, borderRadius: 18, borderWidth: 1, borderColor: dark.border },
  body: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusOverlay: { ...fill, backgroundColor: dark.scrimSoft, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', gap: 4 },
  badgePaper: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.glassLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  badgeWecci: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: dark.scrim, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
});
