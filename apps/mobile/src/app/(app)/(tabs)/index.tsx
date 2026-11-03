import { FEED_TABS, type FeedTab } from '@jefeli/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, MapPin, Radio, Repeat, Sparkles, Tag, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ListingCard, gridItemWidth } from '@/components/ListingCard';
import { PostCard } from '@/components/PostCard';
import { ProfileName } from '@/components/ProfileName';
import { StoryRail } from '@/components/StoryRail';
import {
  Avatar,
  Chip,
  colors,
  EmptyState,
  ErrorState,
  IconButton,
  LiveBadge,
  Screen,
  SearchBar,
  Skeleton,
  spacing,
  Text,
  Wordmark,
} from '@/design';
import { fetchLiveNow, type LiveSessionRow } from '@/lib/api/live';
import { fetchUnreadNotificationCount } from '@/lib/api/notifications';
import { fetchFeed } from '@/lib/api/posts';
import { browseProducts, PRODUCT_PAGE } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { isProduction } from '@/lib/env';
import { toFrenchError } from '@jefeli/shared';
import type { PostCardData, ProductCard } from '@/lib/types';

type PostTab = 'for_you' | 'following' | 'nearby';
const POST_TABS: FeedTab[] = ['for_you', 'following', 'nearby'];

export default function Home() {
  const { userId, profile } = useAuth();
  const [tab, setTab] = useState<FeedTab>('for_you');
  const { width } = useWindowDimensions();
  const isPostTab = POST_TABS.includes(tab);
  const isGridTab = tab === 'occasions' || tab === 'troc';

  const unreadNotifs = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => fetchUnreadNotificationCount(userId as string),
    enabled: !!userId,
    refetchInterval: 90_000,
  });

  const posts = useInfiniteQuery({
    queryKey: ['feed', tab, userId],
    enabled: isPostTab,
    initialPageParam: { offset: 0, before: null as string | null },
    queryFn: ({ pageParam }) => fetchFeed(userId, tab as PostTab, pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const products = useInfiniteQuery({
    queryKey: ['feed-products', tab],
    enabled: isGridTab,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => browseProducts({ mode: tab === 'troc' ? 'troc' : 'occasions', offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PRODUCT_PAGE ? undefined : all.length * PRODUCT_PAGE),
  });

  const live = useQuery({ queryKey: ['live-now'], queryFn: fetchLiveNow, enabled: tab === 'live', refetchInterval: 20_000 });

  const postItems = useMemo(() => posts.data?.pages.flatMap((p) => p.items) ?? [], [posts.data]);
  const productItems = useMemo(() => products.data?.pages.flat() ?? [], [products.data]);
  const productRows = useMemo(() => {
    const rows: ProductCard[][] = [];
    for (let i = 0; i < productItems.length; i += 2) rows.push(productItems.slice(i, i + 2));
    return rows;
  }, [productItems]);

  const active = isPostTab ? posts : isGridTab ? products : live;
  const onRefresh = useCallback(() => {
    active.refetch();
  }, [active]);
  const itemW = gridItemWidth(width);

  const header = (
    <View>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Wordmark size={30} />
          {!isProduction ? (
            <View style={styles.envTag}>
              <Text variant="micro" weight="800" color={colors.warning} style={{ fontSize: 9.5 }}>
                PILOTE
              </Text>
            </View>
          ) : null}
        </View>
        <IconButton icon={Bell} label="Notifications" badge={unreadNotifs.data ?? 0} onPress={() => router.push('/notifications')} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SearchBar onPress={() => router.push('/search')} />
      </View>
      <StoryRail />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FEED_TABS.map((t) => (
          <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>
      {tab === 'nearby' && !profile?.city ? (
        <EmptyState
          compact
          icon={MapPin}
          title="Indiquez votre ville"
          body="Ajoutez votre ville (approximative) dans votre profil pour voir ce qui se passe près de chez vous."
          actionLabel="Modifier mon profil"
          onAction={() => router.push('/edit-profile')}
        />
      ) : null}
    </View>
  );

  const empty = () => {
    if (active.isPending) return <FeedSkeleton grid={isGridTab} />;
    if (active.isError) return <ErrorState message={toFrenchError(active.error)} onRetry={onRefresh} />;
    if (tab === 'nearby' && !profile?.city) return null;
    const map: Record<FeedTab, { icon: typeof Users; title: string; body: string; action?: [string, () => void] }> = {
      for_you: { icon: Sparkles, title: 'Votre fil est encore calme', body: 'Suivez des vendeurs et des amis, ou publiez la première photo de votre boutique.', action: ['Explorer', () => router.push('/explore')] },
      following: { icon: Users, title: 'Aucune publication de vos abonnements', body: 'Suivez des membres depuis Explorer pour retrouver leurs nouveautés ici.', action: ['Trouver des vendeurs', () => router.push('/explore')] },
      nearby: { icon: MapPin, title: `Rien de nouveau à ${profile?.city ?? 'proximité'}`, body: 'Soyez le premier à publier dans votre ville.' },
      live: { icon: Radio, title: 'Aucun live en ce moment', body: 'Les vendeurs que vous suivez apparaîtront ici dès qu’ils passent en direct.' },
      occasions: { icon: Tag, title: 'Pas encore d’occasions', body: 'Vendez un objet que vous n’utilisez plus : il trouvera preneur près de chez vous.', action: ['Vendre un article', () => router.push('/publish/listing')] },
      troc: { icon: Repeat, title: 'Aucun article à échanger', body: 'Proposez un article « À échanger » ou « Vente ou troc ».', action: ['Proposer un troc', () => router.push('/publish/listing')] },
    };
    const e = map[tab];
    return <EmptyState icon={e.icon} title={e.title} body={e.body} actionLabel={e.action?.[0]} onAction={e.action?.[1]} />;
  };

  if (tab === 'live') {
    return (
      <Screen>
        <FlatList
          data={live.data ?? []}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => <LiveRow live={item} />}
          refreshControl={<RefreshControl refreshing={live.isRefetching} onRefresh={onRefresh} tintColor={colors.ink} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      </Screen>
    );
  }

  if (isGridTab) {
    return (
      <Screen>
        <FlatList
          key="grid"
          data={productRows}
          keyExtractor={(row) => row.map((p) => p.id).join('-')}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <View style={styles.gridRow}>
              {item.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} />
              ))}
            </View>
          )}
          onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={onRefresh} tintColor={colors.ink} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList<PostCardData>
        key="posts"
        data={postItems}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <PostCard post={item} showReason={tab === 'for_you'} />}
        onEndReached={() => posts.hasNextPage && !posts.isFetchingNextPage && posts.fetchNextPage()}
        onEndReachedThreshold={0.6}
        ListFooterComponent={posts.isFetchingNextPage ? <FeedSkeleton /> : <View style={{ height: spacing.xl }} />}
        refreshControl={<RefreshControl refreshing={posts.isRefetching && !posts.isFetchingNextPage} onRefresh={onRefresh} tintColor={colors.ink} />}
        removeClippedSubviews
        windowSize={7}
      />
    </Screen>
  );
}

function LiveRow({ live }: { live: LiveSessionRow }) {
  if (!live.host) return null;
  return (
    <Pressable onPress={() => router.push(`/live/${live.id}`)} style={styles.liveRow} accessibilityRole="button" accessibilityLabel={`Live de ${live.host.display_name} : ${live.title}`}>
      <Avatar path={live.host.avatar_path} name={live.host.display_name} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <ProfileName profile={live.host} />
        <Text variant="callout" numberOfLines={2}>
          {live.title}
        </Text>
        {live.viewer_count !== null ? (
          <Text variant="caption" tone="secondary">
            {live.viewer_count} spectateur{live.viewer_count > 1 ? 's' : ''} (selon le fournisseur vidéo)
          </Text>
        ) : null}
      </View>
      <LiveBadge compact />
    </Pressable>
  );
}

function FeedSkeleton({ grid }: { grid?: boolean }) {
  if (grid) {
    return (
      <View style={[styles.gridRow, { paddingTop: spacing.sm }]}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1, gap: 8 }}>
            <Skeleton height={190} radius={12} />
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="80%" />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.surface, paddingVertical: spacing.md, gap: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <Skeleton width={38} height={38} radius={19} />
        <View style={{ gap: 6, flex: 1 }}>
          <Skeleton height={12} width="40%" />
          <Skeleton height={10} width="25%" />
        </View>
      </View>
      <Skeleton height={280} radius={0} />
      <View style={{ paddingHorizontal: spacing.lg, gap: 8 }}>
        <Skeleton height={12} width="90%" />
        <Skeleton height={12} width="55%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  envTag: { backgroundColor: colors.warningSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#F0DFA8' },
  chips: { paddingHorizontal: spacing.lg, gap: 6, paddingBottom: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
});
