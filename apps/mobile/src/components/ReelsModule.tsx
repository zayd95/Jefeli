import { formatListingPrice } from '@jefeli/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Clapperboard, Play } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, spacing, Text } from '@/design';
import { useMediaUrl } from '@/lib/media';
import type { PostCardData } from '@/lib/types';

/** Reels shown in the feed only when this many real ones exist. */
export const REELS_MODULE_MIN = 3;
/** One module after every this many publications. */
export const REELS_MODULE_EVERY = 8;

/**
 * The « Reels » carousel of Accueil (P2): real, ranked Reels only — no placeholder tiles. A tap opens
 * the Reels feed at that video; « Tout voir » opens it from the top.
 */
export function ReelsModule({ reels }: { reels: PostCardData[] }) {
  return (
    <View style={styles.box} testID="reels-module" accessibilityLabel="Reels">
      <View style={styles.head}>
        <View style={styles.title}>
          <Clapperboard size={18} color={dark.text} />
          <Text variant="bodyStrong" weight="800" tone="fog" accessibilityRole="header">
            Reels
          </Text>
        </View>
        <Pressable onPress={() => router.push('/reels')} accessibilityRole="button" accessibilityLabel="Voir tous les Reels" hitSlop={8} style={styles.all}>
          <Text variant="callout" weight="700" tone="mint">
            Tout voir
          </Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={reels}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => <ReelTile post={item} />}
      />
    </View>
  );
}

function ReelTile({ post }: { post: PostCardData }) {
  const video = post.media.find((m) => m.kind === 'video');
  const poster = useMediaUrl(video?.bucket === 'private-media' ? 'private-media' : 'public-media', video?.poster_path);
  const product = post.tagged.map((t) => t.product).find((p) => !!p) ?? null;
  return (
    <Pressable
      onPress={() => router.push(`/reels?start=${post.id}`)}
      style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le Reel de ${post.author?.display_name ?? 'un membre'}${product ? `, ${product.title}, ${formatListingPrice(product)}` : ''}`}
      testID="reel-tile"
    >
      {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.play}>
        <Play size={16} color={dark.text} fill={dark.text} />
      </View>
      <View style={styles.meta}>
        {product ? (
          <Text variant="caption" weight="800" color={colors.white} numberOfLines={1}>
            {formatListingPrice(product)}
          </Text>
        ) : null}
        <Text variant="micro" weight="700" color={colors.white} numberOfLines={1}>
          {post.author?.display_name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: dark.border, marginVertical: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  all: { minHeight: 44, justifyContent: 'center' },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  tile: { width: 124, height: 208, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.mediaBackdrop, justifyContent: 'flex-end', borderWidth: 1, borderColor: dark.border },
  play: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  meta: { padding: 10, gap: 2, backgroundColor: dark.scrim },
});
