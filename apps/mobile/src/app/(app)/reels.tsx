/**
 * Reels (P2): a full-screen vertical feed of permanent public videos.
 *
 *  - Opened from « Fil · Reels » at the top of Accueil, from the end card of the statuses, from any
 *    video of the feed (`?start=<post>` pins it first).
 *  - Pilot ranking (database, explainable): freshness + followed + nearby + has an article.
 *  - One video plays at a time (the active one); the next one is preloaded (paused); everything else
 *    is released. Data saving, 2G and reduced motion turn autoplay off: a tap plays.
 *  - Each Reel shows its article sticker (photo, price, Wecci) and the one gold pill « Faire une
 *    offre »; round 44-pt icons carry the rest.
 *  - The tab bar is not shown: Reels is a stack screen, not a tab.
 */
import { formatListingPrice, toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Clapperboard, Heart, MessageCircle, Share2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type ListViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoPlayerInline } from '@/components/Media';
import { ProductSticker } from '@/components/ProductSticker';
import { Avatar, Button, colors, dark, IconButton, RoundAction, spacing, Text, useToast } from '@/design';
import { fetchReels } from '@/lib/api/reels';
import { messageAboutProduct, openConversationWith } from '@/lib/api/messages';
import { setSave, votePost } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/nav';
import { shareLinks } from '@/lib/share';
import { useMediaUrl } from '@/lib/media';
import type { PostCardData } from '@/lib/types';

export default function Reels() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const [current, setCurrent] = useState(0);
  const q = useInfiniteQuery({
    queryKey: ['reels', userId, start ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchReels(userId ?? null, { offset: pageParam, start: start ?? null }),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  // FlatList requires a callback that never changes identity.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setCurrent(first.index);
  }, []);

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)} testID="reels">
      {height > 0 && items.length > 0 ? (
        <FlatList<PostCardData>
          data={items}
          keyExtractor={(p) => p.id}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
          onEndReachedThreshold={1.5}
          renderItem={({ item, index }) => <ReelItem post={item} height={height} active={index === current} preload={index === current + 1} />}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.white} style={{ height }} /> : undefined}
        />
      ) : q.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : q.isError ? (
        <View style={styles.center}>
          <Text variant="bodyStrong" tone="fog" align="center">
            {toFrenchError(q.error)}
          </Text>
          <Button label="Réessayer" variant="outlineDark" pill onPress={() => void q.refetch()} />
        </View>
      ) : (
        <View style={styles.center}>
          <Clapperboard size={40} color={dark.textSecondary} />
          <Text variant="headline" weight="800" tone="fog" align="center">
            Aucun Reel pour le moment
          </Text>
          <Text variant="callout" tone="fogSecondary" align="center">
            Les vidéos publiées en Reel apparaîtront ici.
          </Text>
        </View>
      )}

      {/* Top: back to Fil, the Fil · Reels switch */}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.sm) }]} pointerEvents="box-none">
        <IconButton icon={X} label="Fermer les Reels" variant="glass" color={colors.white} onPress={() => goBack()} />
        <View style={styles.switch} accessibilityRole="tablist">
          <Pressable onPress={() => goBack()} style={styles.switchItem} accessibilityRole="tab" accessibilityState={{ selected: false }} accessibilityLabel="Fil">
            <Text variant="callout" weight="600" color={dark.textSecondary}>
              Fil
            </Text>
          </Pressable>
          <View style={[styles.switchItem, styles.switchOn]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
            <Text variant="callout" weight="800" color={colors.ink}>
              Reels
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

function ReelItem({ post, height, active, preload }: { post: PostCardData; height: number; active: boolean; preload: boolean }) {
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const video = post.media.find((m) => m.kind === 'video');
  const bucket = video?.bucket === 'private-media' ? 'private-media' : 'public-media';
  const uri = useMediaUrl(bucket, video?.storage_path);
  const poster = useMediaUrl(bucket, video?.poster_path);
  const product = post.tagged.map((t) => t.product).find((p): p is NonNullable<typeof p> => !!p) ?? null;
  const own = post.author_id === userId;
  const [liked, setLiked] = useState(post.my_vote === 1);
  const [saved, setSaved] = useState(!!post.saved);
  const canOffer = !!product && !own && product.status === 'active' && product.listing_mode !== 'trade' && product.listing_mode !== 'give';
  const canTrade = !!product && !own && product.status === 'active' && product.listing_mode !== 'sale' && product.listing_mode !== 'give';
  const author = post.author;

  async function like() {
    const next = !liked;
    setLiked(next);
    try {
      await votePost(post.id, next ? 1 : 0);
    } catch (e) {
      setLiked(!next);
      toast(toFrenchError(e), 'error');
    }
  }
  async function save() {
    if (!userId) return;
    const next = !saved;
    setSaved(next);
    try {
      await setSave(userId, post.id, next);
      void qc.invalidateQueries({ queryKey: ['saved-posts'] });
    } catch (e) {
      setSaved(!next);
      toast(toFrenchError(e), 'error');
    }
  }
  async function message() {
    try {
      const cid = product && !own ? await messageAboutProduct(product.id) : author ? await openConversationWith(author.id) : null;
      if (cid) router.push(product ? `/chat/${cid}?about=${product.id}` : `/chat/${cid}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  return (
    <View style={{ height, backgroundColor: colors.mediaBackdrop }} testID="reel">
      {uri || poster ? <VideoPlayerInline uri={uri ?? ''} posterUri={poster} active={active} preload={preload} loop /> : null}
      <LinearGradient colors={[colors.mediaClear, colors.mediaScrim]} style={styles.shade} pointerEvents="none" />

      {/* Right: round icons, 44 pt, labels on long press */}
      <View style={[styles.rail, { bottom: Math.max(insets.bottom, spacing.md) + 96 }]} pointerEvents="box-none">
        <RoundAction variant="overlay" icon={Heart} label={liked ? 'Retirer mon J’aime' : 'J’aime'} active={liked} filled onPress={like} testID="reel-like" />
        <RoundAction variant="overlay" icon={MessageCircle} label={own ? 'Messages' : 'Écrire à l’auteur'} onPress={message} testID="reel-message" />
        <RoundAction variant="overlay" icon={Share2} label="Partager le Reel" onPress={() => void shareLinks.post(post.id, author?.display_name ?? 'un membre')} testID="reel-share" />
        <RoundAction variant="overlay" icon={Bookmark} label={saved ? 'Retirer des enregistrés' : 'Enregistrer'} active={saved} filled onPress={save} testID="reel-save" />
      </View>

      {/* Bottom: author, caption, article sticker, the gold pill */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
        <Pressable onPress={() => author && router.push(`/u/${author.handle}`)} style={styles.author} accessibilityRole="button" accessibilityLabel={`Voir le profil de ${author?.display_name ?? 'l’auteur'}`}>
          <Avatar path={author?.avatar_path} name={author?.display_name ?? '?'} size={36} />
          <Text variant="callout" weight="800" color={colors.white}>
            {author?.display_name}
          </Text>
        </Pressable>
        {post.body ? (
          <Text variant="callout" color={colors.white} numberOfLines={2} style={styles.caption}>
            {post.body}
          </Text>
        ) : null}
        {product ? (
          <View style={styles.productRow}>
            <ProductSticker product={product} />
            {canOffer ? (
              <Button label="Faire une offre" variant="cta" pill onPress={() => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'price' } })} testID="reel-offer" />
            ) : canTrade ? (
              <Button label="Proposer un troc" variant="cta" pill onPress={() => router.push({ pathname: '/offer/[productId]', params: { productId: product.id, kind: 'barter' } })} testID="reel-offer" />
            ) : null}
          </View>
        ) : null}
        {product && !canOffer && !canTrade && !own ? (
          <Text variant="caption" color={colors.mediaText}>
            {`${formatListingPrice(product)} · pas d’offre possible pour le moment`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mediaBackdrop },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  top: { position: 'absolute', top: 0, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switch: { flexDirection: 'row', padding: 3, borderRadius: 22, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  switchItem: { minWidth: 72, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  switchOn: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.gold },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 },
  rail: { position: 'absolute', right: spacing.md, gap: spacing.md, alignItems: 'center' },
  bottom: { position: 'absolute', left: spacing.lg, right: 76, bottom: 0, gap: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', minHeight: 44 },
  caption: { textShadowColor: colors.mediaScrimStrong, textShadowRadius: 6 },
  productRow: { gap: spacing.sm, alignItems: 'flex-start' },
});
