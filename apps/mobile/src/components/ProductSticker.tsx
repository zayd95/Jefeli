import { formatListingPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, spacing, Text } from '@/design';
import type { TaggedProduct } from '@/lib/types';

import { Thumb } from './Media';

/**
 * The product sticker of a status or a Reel (P2): the article's photo, its name and price, and the
 * mint « Wecci » badge when it can be swapped or given. A tap opens the article. It is a link, not a
 * button of its own: the one gold action of the screen stays « Faire une offre ».
 */
export function ProductSticker({ product, onOpen }: { product: TaggedProduct; onOpen?: () => void }) {
  const wecci = product.listing_mode !== 'sale';
  const sold = product.status === 'sold' ? 'Vendu' : product.status === 'reserved' ? 'Réservé' : null;
  return (
    <Pressable
      testID="product-sticker"
      onPress={() => (onOpen ? onOpen() : router.push(`/p/${product.id}`))}
      style={({ pressed }) => [styles.box, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="link"
      accessibilityLabel={`Voir l’article ${product.title}, ${formatListingPrice(product)}${wecci ? ', Wecci' : ''}`}
    >
      <Thumb media={[...product.media].sort((a, b) => a.position - b.position)[0]} style={styles.thumb} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="callout" weight="700" tone="fog" numberOfLines={1}>
          {product.title}
        </Text>
        <View style={styles.line}>
          <Text variant="callout" weight="800" tone="fog">
            {sold ?? formatListingPrice(product)}
          </Text>
          {wecci ? (
            <View style={styles.wecci}>
              <Text variant="micro" weight="800" color={colors.wecci}>
                WECCI
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 6, paddingRight: spacing.md, borderRadius: 16, backgroundColor: dark.scrim, borderWidth: 1, borderColor: dark.glassBorder, maxWidth: 320 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wecci: { paddingHorizontal: 8, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.wecci, alignItems: 'center', justifyContent: 'center' },
});
