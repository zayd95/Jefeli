/**
 * Accueil, ported from the approved Lovable feed (Atlantic After Dark, #091B19):
 *   - a fixed header: serif wordmark with a gold dot, round glass search and notifications,
 *     « Pour toi » / « Abonnements » with a mint underline;
 *   - the story rail, then quiet discovery chips (my city → the nearby feed; Wecci and
 *     Occasions → Explorer with that filter; « En direct » only once live video is enabled);
 *   - editorial post cards, real empty / loading / error states and a « Vous êtes à jour » end.
 * Feed queries, pagination, ranking reasons and the live list are the existing native ones.
 * Product grids moved to Explorer: Home stays social-first.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Bell, Compass, LogIn, MapPin, Radio, Repeat2, Search, Sparkles, Tag, Users, type LucideIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ListViewToken } from 'react-native';

import { DiscoveryRail } from '@/components/desktop/DiscoveryRail';
import { ActivePostContext, pauseAllVideos } from '@/components/Media';
import { PostCard } from '@/components/PostCard';
import { ProfileName } from '@/components/ProfileName';
import { StoryRail } from '@/components/StoryRail';
import { Avatar, Button, colors, dark, EmptyState, ErrorState, IconButton, InlineRetry, LiveBadge, Screen, Skeleton, spacing, Text, Wordmark } from '@/design';
import { fetchLiveNow, type LiveSessionRow } from '@/lib/api/live';
import { fetchUnreadNotificationCount } from '@/lib/api/notifications';
import { fetchFeed } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { useDiagnosed } from '@/lib/diagnostics';
import { useDockSpace } from '@/lib/dock';
import { isProduction } from '@/lib/env';
import { useFlag } from '@/lib/flags';
import { useLayout } from '@/lib/layout';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { PostCardData } from '@/lib/types';

type HomeTab = 'for_you' | 'following' | 'nearby' | 'live';
const TAB_LABEL: Record<HomeTab, string> = { for_you: 'Pour toi', following: 'Abonnements', nearby: 'À proximité', live: 'En direct' };

const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 250 };

export default function Home() {
  useDarkStatusBar();
  const { userId, profile, signOut } = useAuth();
  const dockSpace = useDockSpace();
  const liveEnabled = useFlag('live_streaming');
  const { desktop, wide } = useLayout();
  const [tab, setTab] = useState<HomeTab>('for_you');
  const isPostTab = tab !== 'live';

  const unreadNotifs = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => fetchUnreadNotificationCount(userId as string),
    enabled: !!userId,
    refetchInterval: 90_000,
  });

  const posts = useInfiniteQuery({
    queryKey: ['feed', tab, userId],
    enabled: isPostTab && !(tab === 'nearby' && !profile?.city),
    initialPageParam: { offset: 0, before: null as string | null },
    queryFn: ({ pageParam }) => fetchFeed(userId, tab as Exclude<HomeTab, 'live'>, pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const live = useQuery({ queryKey: ['live-now'], queryFn: fetchLiveNow, enabled: tab === 'live', refetchInterval: 20_000 });

  const postItems = useMemo(() => posts.data?.pages.flatMap((p) => p.items) ?? [], [posts.data]);

  // Video playback (W1.1): the topmost card at least 60 % on screen is the « active » one; its
  // video may autoplay muted. Leaving Accueil (another tab, a pushed screen) pauses everything.
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [focused, setFocused] = useState(true);
  // FlatList requires a callback that never changes identity.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    setActivePostId((viewableItems.find((v) => v.isViewable)?.item as PostCardData | undefined)?.id ?? null);
  }, []);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        pauseAllVideos();
      };
    }, []),
  );
  const active = isPostTab ? posts : live;
  const onRefresh = useCallback(() => {
    active.refetch();
  }, [active]);
  // W1.3: a failed request never leaves a dead homepage — a precise message, a retry, a way
  // around (Explorer) and diagnostics support can use. Refresh failures over visible posts only
  // show a quiet banner; the posts stay.
  const where = `Accueil · ${TAB_LABEL[tab]}`;
  const failed = useDiagnosed(active.isError && !active.data ? active.error : null, where);
  const refreshFailed = isPostTab && posts.isRefetchError && postItems.length > 0;
  const nextFailed = isPostTab && posts.isFetchNextPageError;

  const chips: { key: string; label: string; icon: LucideIcon; selected?: boolean; onPress: () => void }[] = [
    {
      key: 'nearby',
      label: profile?.city ? `À ${profile.city}` : 'À proximité',
      icon: MapPin,
      selected: tab === 'nearby',
      onPress: () => setTab(tab === 'nearby' ? 'for_you' : 'nearby'),
    },
    { key: 'wecci', label: 'Wecci · Échange', icon: Repeat2, onPress: () => router.push({ pathname: '/explore', params: { kind: 'trade' } }) },
    { key: 'occasions', label: 'Occasions', icon: Tag, onPress: () => router.push({ pathname: '/explore', params: { kind: 'used' } }) },
    ...(liveEnabled ? [{ key: 'live', label: 'En direct', icon: Radio, selected: tab === 'live', onPress: () => setTab(tab === 'live' ? 'for_you' : 'live') }] : []),
  ];

  const top = (
    <View style={styles.header}>
      {desktop ? null : (
      <View style={styles.headerRow}>
        <Wordmark size={30} color={dark.text} />
        <View style={styles.headerActions}>
          <IconButton icon={Search} label="Rechercher" variant="glass" size={20} color={dark.text} onPress={() => router.push('/search')} />
          <IconButton icon={Bell} label="Notifications" variant="glass" size={20} color={dark.text} badge={unreadNotifs.data ?? 0} onPress={() => router.push('/notifications')} />
        </View>
      </View>
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ['for_you', 'Pour toi'],
            ['following', 'Abonnements'],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={label}>
              <Text weight="700" color={on ? dark.text : dark.textTertiary} style={{ fontSize: 15, lineHeight: 20 }}>
                {label}
              </Text>
              {on ? <View style={styles.tabLine} /> : null}
            </Pressable>
          );
        })}
        {!isProduction ? (
          <View style={styles.envTag} accessibilityLabel="Version pilote">
            <Text variant="micro" weight="800" tone="fogSecondary" style={{ fontSize: 10, letterSpacing: 1.2 }}>
              PILOTE
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const listHeader = (
    <View>
      {refreshFailed ? <InlineRetry tone="dark" message="Actualisation impossible. Le fil affiché n’est peut-être pas à jour." onRetry={onRefresh} retrying={posts.isRefetching} /> : null}
      <StoryRail />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {chips.map(({ key, label, icon: Icon, selected, onPress }) => (
          <Pressable
            key={key}
            onPress={onPress}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { transform: [{ scale: 0.96 }] }]}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            aria-selected={!!selected}
            accessibilityLabel={label}
          >
            <Icon size={14} color={dark.mint} strokeWidth={2.2} />
            <Text variant="callout" weight="600" color={selected ? dark.text : dark.textStrong} style={{ fontSize: 13 }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const empty = () => {
    if (tab === 'nearby' && !profile?.city) {
      return (
        <EmptyState
          tone="dark"
          compact
          icon={MapPin}
          title="Indiquez votre ville"
          body="Ajoutez votre ville pour voir ce qui se passe près de chez vous."
          actionLabel="Modifier mon profil"
          onAction={() => router.push('/edit-profile')}
        />
      );
    }
    if (active.isPending) return <FeedSkeleton />;
    if (failed) {
      return (
        <ErrorState
          tone="dark"
          title={failed.failure.title}
          message={failed.failure.message}
          onRetry={onRefresh}
          retrying={active.isFetching}
          alternative={
            failed.failure.kind === 'session'
              ? { label: 'Se reconnecter', icon: LogIn, onPress: () => void signOut() }
              : { label: 'Explorer', icon: Compass, onPress: () => router.push('/explore') }
          }
          details={failed.details}
        />
      );
    }
    const map: Record<HomeTab, { icon: LucideIcon; title: string; body: string; action?: [string, () => void] }> = {
      for_you: { icon: Sparkles, title: 'Le fil commence ici', body: 'Partagez la première publication ou suivez des membres.', action: ['Publier', () => router.push('/publish/post')] },
      following: { icon: Users, title: 'Découvrez votre communauté', body: 'Suivez des membres pour voir leurs publications ici.', action: ['Explorer', () => router.push('/explore')] },
      nearby: { icon: MapPin, title: `Rien de nouveau à ${profile?.city ?? 'proximité'}`, body: 'Soyez le premier à publier dans votre ville.', action: ['Publier', () => router.push('/publish/post')] },
      live: { icon: Radio, title: 'Aucun live en ce moment', body: 'Les directs des vendeurs suivis apparaîtront ici.' },
    };
    const e = map[tab];
    return <EmptyState tone="dark" icon={e.icon} title={e.title} body={e.body} actionLabel={e.action?.[0]} onAction={e.action?.[1]} />;
  };

  const footer = () => {
    if (!isPostTab) return <View style={{ height: dockSpace }} />;
    if (posts.isFetchingNextPage) return <FeedSkeleton />;
    return (
      <View style={{ paddingBottom: dockSpace }}>
        {nextFailed ? <InlineRetry tone="dark" message="Impossible de charger la suite du fil." onRetry={() => posts.fetchNextPage()} /> : null}
        {postItems.length > 0 && !posts.hasNextPage && !nextFailed ? (
          <View style={styles.caughtUp}>
            <Text serif variant="title" tone="fog" align="center" style={{ fontSize: 20 }}>
              Vous êtes à jour
            </Text>
            <Button label="Continuer dans Explorer" variant="outlineDark" pill icon={Compass} onPress={() => router.push('/explore')} style={{ marginTop: spacing.md }} />
          </View>
        ) : null}
      </View>
    );
  };

  const body = (
    <>
      {top}
      {tab === 'live' ? (
        <FlatList
          data={live.data ?? []}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          renderItem={({ item }) => <LiveRow live={item} />}
          refreshControl={<RefreshControl refreshing={live.isRefetching} onRefresh={onRefresh} tintColor={dark.text} />}
        />
      ) : (
        <ActivePostContext.Provider value={focused ? activePostId : null}>
        <FlatList<PostCardData>
          key="posts"
          data={tab === 'nearby' && !profile?.city ? [] : postItems}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          renderItem={({ item }) => <PostCard post={item} showReason={tab === 'for_you'} />}
          viewabilityConfig={VIEWABILITY}
          onViewableItemsChanged={onViewable}
          onEndReached={() => posts.hasNextPage && !posts.isFetchingNextPage && posts.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListFooterComponent={footer}
          refreshControl={<RefreshControl refreshing={posts.isRefetching && !posts.isFetchingNextPage} onRefresh={onRefresh} tintColor={dark.text} />}
          removeClippedSubviews
          windowSize={7}
          indicatorStyle="white"
        />
        </ActivePostContext.Provider>
      )}
    </>
  );

  if (!desktop) return <Screen background={dark.background}>{body}</Screen>;
  // Desktop web (W1.4): the same dark feed in a centered column; on wide screens a contextual
  // rail of real requests, linked articles, nearby articles and boutiques.
  return (
    <Screen background={dark.background}>
      <View style={styles.desktopRow}>
        <View style={styles.desktopFeed}>{body}</View>
        {wide ? <DiscoveryRail feed={postItems} /> : null}
      </View>
    </Screen>
  );
}

function LiveRow({ live }: { live: LiveSessionRow }) {
  if (!live.host) return null;
  return (
    <Pressable onPress={() => router.push(`/live/${live.id}`)} style={styles.liveRow} accessibilityRole="button" accessibilityLabel={`Live de ${live.host.display_name} : ${live.title}`}>
      <Avatar path={live.host.avatar_path} name={live.host.display_name} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <ProfileName profile={live.host} tone="dark" />
        <Text variant="callout" tone="fog" numberOfLines={2}>
          {live.title}
        </Text>
        {live.viewer_count !== null ? (
          <Text variant="caption" tone="fogSecondary">
            {live.viewer_count} spectateur{live.viewer_count > 1 ? 's' : ''} (selon le fournisseur vidéo)
          </Text>
        ) : null}
      </View>
      <LiveBadge compact />
    </Pressable>
  );
}

/** Loading state in the Lovable shape: avatar + line, then a 4:5 media block. */
function FeedSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: 20, gap: spacing.xl }} accessibilityLabel="Chargement">
      {[0, 1].map((i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
            <Skeleton tone="dark" width={40} height={40} radius={20} />
            <Skeleton tone="dark" height={40} radius={12} style={{ flex: 1 }} />
          </View>
          <Skeleton tone="dark" height={360} radius={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  desktopFeed: { flex: 1, maxWidth: 640, minWidth: 0, borderLeftWidth: 1, borderRightWidth: 1, borderColor: dark.border },
  header: { backgroundColor: dark.header, borderBottomWidth: 1, borderBottomColor: dark.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingHorizontal: spacing.lg },
  tab: { height: 40, justifyContent: 'center' },
  tabLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: colors.mint },
  envTag: { marginLeft: 'auto', backgroundColor: dark.subtle, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: dark.borderStrong },
  chipOn: { borderColor: dark.mintLine, backgroundColor: dark.mintSelected },
  caughtUp: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderColor: dark.border },
});
