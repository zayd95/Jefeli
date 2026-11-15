/**
 * Member profile, ported from the approved Lovable compact profile (Atlantic night):
 *   - a short atmospheric cover (≈136 pt) with glass back / share / settings-or-more;
 *   - the avatar overlapping the cover (status ring when a status is live), name in the serif,
 *     @handle and place, real follower counts, and the bio straight away;
 *   - up to three business-interest chips (+N), one action row (Edit / Publish for me,
 *     Message / Follow for visitors), and « Plus d'infos » for the rest;
 *   - only two primary tabs, Publications and Boutique: three compact post previews or four
 *     product tiles before « Voir plus ». No boutique carousel and no pinned hero above them.
 * Statuses, highlights, reviews, boutique details, privacy, friends, report and block stay
 * reachable (avatar ring, « Plus d'infos » and sheets, the ⋯ menu), on the same native APIs.
 */
import { formatMemberSince, plural, timeAgo, toFrenchError, INTENT_LABELS, isPostIntent } from '@jefeli/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Link2,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Settings,
  Share2,
  Star,
  Store,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, colors, dark, DemoBadge, EmptyState, ErrorState, IconButton, Motif, radius, Sheet, SheetAction, Skeleton, spacing, Text, useToast, VerifiedBadge } from '@/design';
import { fill } from '@/design/fill';
import { openConversationWith } from '@/lib/api/messages';
import { fetchReviews } from '@/lib/api/offers';
import { fetchPinnedPosts, fetchUserPosts } from '@/lib/api/posts';
import { fetchBoutique, fetchCategories, fetchSellerProducts } from '@/lib/api/products';
import {
  cancelFriendRequest,
  follow,
  getRelationship,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  unfollow,
  type Relationship,
} from '@/lib/api/profiles';
import { fetchActiveStories, fetchHighlights } from '@/lib/api/stories';
import { useAuth } from '@/lib/auth';
import { useDockSpace } from '@/lib/dock';
import { avatarUrl } from '@/lib/media';
import { goBack } from '@/lib/nav';
import { shareLinks, whatsappLinks } from '@/lib/share';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { PostCardData, ProductCard, ProfileRow } from '@/lib/types';

import { ContentMenu, confirmAsync } from './ContentMenu';
import { gridItemWidth, ListingCard } from './ListingCard';
import { useLayout } from '@/lib/layout';
import { Thumb } from './Media';
import { PostCard } from './PostCard';

type Tab = 'posts' | 'boutique';
type Item = { type: 'tabs' } | { type: 'post'; post: PostCardData } | { type: 'expanded'; post: PostCardData } | { type: 'row'; items: ProductCard[] } | { type: 'more'; label: string; onPress: () => void } | { type: 'empty' };

const POST_STEP = 3;
const ITEM_STEP = 4;
const INTEREST_CHIPS = 3;

export function ProfileView({ profile, isOwnTab }: { profile: ProfileRow; isOwnTab?: boolean }) {
  useDarkStatusBar();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const dockSpace = useDockSpace();
  const { width } = useWindowDimensions();
  const { desktop } = useLayout();
  const [contentW, setContentW] = useState(width);
  // Desktop (W1.4): the same dark profile centered at 960 px, 3–4 boutique columns.
  const cols = desktop ? (Math.min(contentW, 960) >= 860 ? 4 : 3) : 2;
  const isSelf = userId === profile.id;
  const [tab, setTab] = useState<Tab>('posts');
  const [menu, setMenu] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [reviewsSheet, setReviewsSheet] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [allInterests, setAllInterests] = useState(false);
  const [postLimit, setPostLimit] = useState(POST_STEP);
  const [itemLimit, setItemLimit] = useState(ITEM_STEP);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rel = useQuery({ queryKey: ['relationship', profile.id], queryFn: () => getRelationship(profile.id), enabled: !isSelf });
  const r: Relationship = rel.data ?? { authenticated: true };
  const locked = !isSelf && profile.is_private && r.follow_status !== 'accepted' && !r.is_friend;

  const products = useQuery({
    queryKey: ['seller-products', profile.id, isSelf],
    queryFn: () => fetchSellerProducts(profile.id, { includeSold: true }),
    enabled: !locked,
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const stories = useQuery({ queryKey: ['active-stories', profile.id], queryFn: () => fetchActiveStories(profile.id), enabled: !locked });
  const highlights = useQuery({ queryKey: ['highlights', profile.id], queryFn: () => fetchHighlights(profile.id), enabled: !locked });
  const boutique = useQuery({ queryKey: ['boutique', profile.id], queryFn: () => fetchBoutique(profile.id), enabled: !locked && showInfo });
  const posts = useInfiniteQuery({
    queryKey: ['user-posts', profile.id],
    enabled: !locked && tab === 'posts',
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchUserPosts(userId, profile.id, pageParam),
    getNextPageParam: (last) => (last.length < 12 ? undefined : last[last.length - 1]?.created_at),
  });
  const pinnedPosts = useQuery({
    queryKey: ['pinned-posts', profile.id],
    queryFn: () => fetchPinnedPosts(userId, profile.id),
    enabled: !locked && tab === 'posts',
  });
  const reviews = useQuery({ queryKey: ['reviews', profile.id], queryFn: () => fetchReviews(profile.id), enabled: !locked && reviewsSheet });

  const productList = useMemo(() => products.data ?? [], [products.data]);
  const timeline = useMemo(() => {
    const pinned = pinnedPosts.data ?? [];
    const pinnedIds = new Set(pinned.map((p) => p.id));
    return [...pinned, ...(posts.data?.pages.flat() ?? []).filter((p) => !pinnedIds.has(p.id))];
  }, [pinnedPosts.data, posts.data]);
  const hasStories = (stories.data?.length ?? 0) > 0;
  const interests = profile.interests ?? [];
  const interestLabel = (slug: string) => categories.data?.find((c) => c.slug === slug)?.name ?? slug;
  const boutiqueCategory = profile.boutique_category_slug ? interestLabel(profile.boutique_category_slug) : null;
  const avgRating = profile.rating_count > 0 ? profile.rating_sum / profile.rating_count : null;
  const coverUri = avatarUrl(profile.cover_path);
  const coverHeight = Math.max(136, insets.top + 96);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['relationship', profile.id] });
    qc.invalidateQueries({ queryKey: ['profile', profile.handle] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };

  async function act(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) toast(success, 'success');
      refresh();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function startChat() {
    setBusy('message');
    try {
      const cid = await openConversationWith(profile.id);
      router.push(`/chat/${cid}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const following = r.follow_status === 'accepted';
  const followLabel = following ? 'Abonné(e)' : r.follow_status === 'pending' ? 'Demande envoyée' : r.follows_me ? 'Suivre en retour' : 'Suivre';

  const friendButton = () => {
    if (isSelf || r.blocked) return null;
    const style = styles.roundAction;
    if (r.is_friend)
      return (
        <IconButton
          icon={Users}
          label="Ami(e) — retirer des amis"
          color={dark.mint}
          style={style}
          onPress={async () => {
            if (await confirmAsync('Retirer des amis ?', `${profile.display_name} ne verra plus vos contenus réservés aux amis.`, 'Retirer'))
              act('friend', () => removeFriend(profile.id), 'Retiré(e) de vos amis');
          }}
        />
      );
    if (r.friend_request_direction === 'incoming' && r.friend_request_id)
      return (
        <IconButton icon={Check} label="Accepter l’ami" color={dark.mint} style={style} onPress={() => act('friend', () => respondFriendRequest(r.friend_request_id as string, true), 'Vous êtes maintenant amis')} />
      );
    if (r.friend_request_direction === 'outgoing' && r.friend_request_id)
      return <IconButton icon={Clock} label="Demande d’ami envoyée — annuler" color={dark.textStrong} style={style} onPress={() => act('friend', () => cancelFriendRequest(r.friend_request_id as string), 'Demande annulée')} />;
    return <IconButton icon={UserPlus} label="Ajouter en ami" color={dark.textStrong} style={style} onPress={() => act('friend', () => sendFriendRequest(profile.id), 'Demande d’ami envoyée')} />;
  };

  const counts: { value: number; label: string; kind: 'followers' | 'following' | 'friends' }[] = [
    { value: profile.followers_count, label: plural(profile.followers_count, 'Abonné', 'Abonnés'), kind: 'followers' },
    { value: profile.following_count, label: plural(profile.following_count, 'Abonnement', 'Abonnements'), kind: 'following' },
    { value: profile.friends_count, label: plural(profile.friends_count, 'Ami', 'Amis'), kind: 'friends' },
  ];

  const ring = (
    <View style={styles.avatarRing}>
      {hasStories ? (
        <LinearGradient colors={[dark.mint, dark.mint, dark.gold]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={[fill, { borderRadius: 36 }]} />
      ) : (
        <View style={[fill, { borderRadius: 36, backgroundColor: dark.borderStrong }]} />
      )}
      <View style={styles.avatarInner}>
        <Avatar path={profile.avatar_path} name={profile.display_name} size={62} />
      </View>
    </View>
  );

  const header = (
    <View>
      {/* Atmospheric cover, not a hero screen. */}
      <View style={{ height: coverHeight, backgroundColor: dark.surface }}>
        {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Photo de couverture" /> : <Motif />}
        <LinearGradient colors={[dark.scrimSoft, 'transparent', dark.scrimSoft]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[styles.coverBar, { paddingTop: Math.max(insets.top, 10) }]}>
          {isOwnTab ? <View style={{ width: 40 }} /> : <IconButton icon={ArrowLeft} label="Retour" variant="glass" size={20} color={dark.text} onPress={() => goBack()} />}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <IconButton icon={Share2} label="Partager le profil" variant="glass" size={19} color={dark.text} onPress={() => setShareSheet(true)} />
            {isSelf ? (
              <IconButton icon={Settings} label="Réglages" variant="glass" size={19} color={dark.text} onPress={() => router.push('/settings')} />
            ) : (
              <IconButton icon={MoreHorizontal} label="Plus d’options" variant="glass" size={19} color={dark.text} onPress={() => setMenu(true)} />
            )}
          </View>
        </View>
      </View>

      <View style={styles.presentation}>
        <View style={styles.avatarRow}>
          {isSelf || hasStories ? (
            <Pressable
              onPress={() => (hasStories ? router.push(`/statut/${profile.id}`) : router.push('/publish/status'))}
              accessibilityRole="button"
              accessibilityLabel={hasStories ? (isSelf ? 'Voir mon statut' : 'Voir ses statuts') : 'Ajouter un statut'}
              style={({ pressed }) => pressed && { transform: [{ scale: 0.96 }] }}
            >
              {ring}
            </Pressable>
          ) : (
            ring
          )}
          {profile.is_merchant && profile.boutique_name ? (
            <View style={styles.boutiqueChip}>
              <Store size={12} color={dark.gold} strokeWidth={2.2} />
              <Text variant="micro" weight="700" tone="gold" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
                {[profile.boutique_name, boutiqueCategory].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.nameRow}>
          <Text serif weight="600" tone="fog" numberOfLines={2} style={styles.name} accessibilityRole="header">
            {profile.display_name}
          </Text>
          {profile.verification_level === 'merchant_verified' ? <VerifiedBadge size={18} /> : null}
        </View>
        <View style={styles.metaRow}>
          <Text variant="caption" tone="fogSecondary" style={{ fontSize: 12 }}>
            @{profile.handle}
          </Text>
          {profile.city ? (
            <>
              <Text variant="caption" tone="fogTertiary" style={{ fontSize: 12 }}>
                ·
              </Text>
              <MapPin size={13} color={dark.textSecondary} />
              <Text variant="caption" tone="fogSecondary" style={{ fontSize: 12 }}>
                {[profile.neighborhood, profile.city].filter(Boolean).join(', ')}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {counts.map((c, i) => (
            <Pressable
              key={c.kind}
              onPress={locked ? undefined : () => router.push({ pathname: '/connections/[userId]', params: { userId: profile.id, kind: c.kind } })}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`${c.value} ${c.label}`}
              hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
            >
              <Text variant="caption" tone="fogSecondary" style={{ fontSize: 12 }}>
                <Text variant="caption" weight="700" tone="fog" style={{ fontSize: 12 }}>
                  {c.value}
                </Text>{' '}
                {c.label.toLowerCase()}
                {i < counts.length - 1 ? '  ·' : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {profile.bio ? (
          <Text weight="500" color={dark.textStrong} style={styles.bio}>
            {profile.bio}
          </Text>
        ) : isSelf ? (
          <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" style={{ marginTop: spacing.md }}>
            <Text variant="caption" weight="600" tone="mint">
              + Ajouter une bio
            </Text>
          </Pressable>
        ) : null}

        {interests.length > 0 || isSelf ? (
          <View style={{ marginTop: spacing.md }} accessibilityLabel="Intérêts business">
            <Text variant="micro" weight="700" tone="gold" style={styles.overline}>
              INTÉRÊTS BUSINESS
            </Text>
            {interests.length ? (
              <View style={styles.interests}>
                {(allInterests ? interests : interests.slice(0, INTEREST_CHIPS)).map((slug) => (
                  <View key={slug} style={styles.interest}>
                    <Text variant="micro" weight="500" color={dark.textStrong} style={{ fontSize: 11 }}>
                      {interestLabel(slug)}
                    </Text>
                  </View>
                ))}
                {interests.length > INTEREST_CHIPS ? (
                  <Pressable onPress={() => setAllInterests((x) => !x)} aria-expanded={allInterests} accessibilityRole="button" accessibilityLabel={allInterests ? 'Moins d’intérêts' : `${interests.length - INTEREST_CHIPS} autres intérêts`} hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }} style={styles.interestMore}>
                    <Text variant="micro" weight="600" tone="mint" style={{ fontSize: 11 }}>
                      {allInterests ? 'Moins' : `+${interests.length - INTEREST_CHIPS}`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button">
                <Text variant="caption" weight="600" tone="mint">
                  + Ajouter des secteurs d’intérêt
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {isSelf ? (
          <View style={styles.actions}>
            <Button label="Modifier le profil" variant="outlineDark" pill style={{ flex: 1 }} onPress={() => router.push('/edit-profile')} />
            <Button label="Publier" variant="cta" pill icon={Plus} style={{ flex: 1 }} onPress={() => router.push('/publish/post')} />
          </View>
        ) : r.blocked ? (
          <Text tone="fogSecondary" style={{ marginTop: spacing.lg }}>
            Vous avez bloqué ce compte. Débloquez-le depuis Réglages › Comptes bloqués.
          </Text>
        ) : (
          <View style={styles.actions}>
            <Button label="Message" variant="cta" pill icon={Send} style={{ flex: 1 }} loading={busy === 'message'} onPress={startChat} />
            <Pressable
              onPress={() =>
                act('follow', () => (r.follow_status ? unfollow(userId ?? '', profile.id) : follow(userId ?? '', profile.id)), r.follow_status ? undefined : profile.is_private ? 'Demande d’abonnement envoyée' : undefined)
              }
              disabled={busy === 'follow'}
              style={({ pressed }) => [styles.follow, following && styles.followOn, pressed && { transform: [{ scale: 0.97 }] }, busy === 'follow' && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={followLabel}
              accessibilityState={{ selected: following, busy: busy === 'follow' }}
              aria-pressed={following}
            >
              {following ? <Check size={16} color={dark.mint} strokeWidth={2.4} /> : null}
              <Text variant="callout" weight="700" color={following ? dark.mint : dark.text} style={{ fontSize: 13 }}>
                {followLabel}
              </Text>
            </Pressable>
            {friendButton()}
          </View>
        )}

        <View style={styles.infoToggleRow}>
          <Pressable onPress={() => setShowInfo((v) => !v)} aria-expanded={showInfo} accessibilityRole="button" hitSlop={{ top: 4, bottom: 4, right: 12 }} style={styles.infoToggle}>
            <Text variant="caption" weight="600" tone="fogSecondary" style={{ fontSize: 12 }}>
              {showInfo ? 'Masquer les infos' : 'Plus d’infos'}
            </Text>
            <ChevronDown size={14} color={dark.textSecondary} style={showInfo ? { transform: [{ rotate: '180deg' }] } : undefined} />
          </Pressable>
          {profile.is_demo ? <DemoBadge tone="dark" /> : null}
        </View>

        {showInfo ? (
          <View style={styles.info}>
            <InfoRow label="Activité" value={profile.is_merchant ? [profile.boutique_name, boutiqueCategory].filter(Boolean).join(' · ') || 'Vendeur' : 'Membre'} />
            {profile.city ? <InfoRow label="Localisation" value={[profile.neighborhood, profile.city].filter(Boolean).join(', ')} /> : null}
            <InfoRow label="Sur Jëfëli" value={formatMemberSince(profile.created_at)} />
            {!locked ? (
              <>
                <InfoLink
                  icon={Star}
                  label={avgRating !== null ? `Avis · ${avgRating.toFixed(1).replace('.', ',')} sur 5 (${profile.rating_count})` : 'Avis · pas encore d’avis'}
                  onPress={() => setReviewsSheet(true)}
                />
                {hasStories ? <InfoLink icon={Clock} label={`${isSelf ? 'Mes statuts' : 'Ses statuts'} en cours · ${stories.data?.length ?? 0}`} onPress={() => router.push(`/statut/${profile.id}`)} /> : null}
                {(highlights.data ?? []).map((h) => (
                  <InfoLink key={h.id} icon={Star} label={`Sélection · ${h.title} (${h.items.length})`} onPress={() => router.push(`/highlight/${h.id}`)} />
                ))}
                {isSelf ? <InfoLink icon={Plus} label="Publier un statut (24 h)" onPress={() => router.push('/publish/status')} /> : null}
                <BoutiqueInfo boutique={boutique.data} isSelf={isSelf} />
              </>
            ) : null}
            <Text variant="caption" tone="fogSecondary" style={{ fontSize: 12 }}>
              Paiements et remises convenus directement entre les membres. Jëfëli ne détient aucun fonds.
            </Text>
          </View>
        ) : null}
      </View>

      {locked ? <EmptyState tone="dark" icon={Lock} title="Ce compte est privé" body="Abonnez-vous pour voir ses publications, ses statuts et sa boutique." /> : null}
    </View>
  );

  // Data: the sticky tab bar first, then the selected tab's compact content.
  const data: Item[] = useMemo(() => {
    if (locked) return [];
    const out: Item[] = [{ type: 'tabs' }];
    if (tab === 'posts') {
      const expanded = timeline.find((p) => p.id === expandedId);
      if (expanded) return [...out, { type: 'expanded', post: expanded }];
      if (posts.isPending) return out;
      if (timeline.length === 0) return [...out, { type: 'empty' }];
      out.push(...timeline.slice(0, postLimit).map((post) => ({ type: 'post' as const, post })));
      if (timeline.length > postLimit || posts.hasNextPage)
        out.push({
          type: 'more',
          label: 'Voir plus de publications',
          onPress: () => {
            setPostLimit((n) => n + POST_STEP);
            if (timeline.length <= postLimit + POST_STEP && posts.hasNextPage && !posts.isFetchingNextPage) posts.fetchNextPage();
          },
        });
      return out;
    }
    if (products.isPending) return out;
    if (productList.length === 0) return [...out, { type: 'empty' }];
    const shown = productList.slice(0, itemLimit);
    for (let i = 0; i < shown.length; i += cols) out.push({ type: 'row', items: shown.slice(i, i + cols) });
    if (productList.length > itemLimit) out.push({ type: 'more', label: 'Voir plus d’articles', onPress: () => setItemLimit((n) => n + ITEM_STEP) });
    return out;
  }, [locked, tab, timeline, expandedId, posts, postLimit, products.isPending, productList, itemLimit, cols]);

  const itemW = desktop ? Math.floor((Math.min(contentW, 960) - spacing.lg * 2 - spacing.md * (cols - 1)) / cols) : gridItemWidth(width);
  const tabs = (
    <View style={styles.tabs} accessibilityRole="tablist" aria-label="Contenu du profil">
      {(
        [
          ['posts', 'Publications', profile.posts_count],
          ['boutique', 'Boutique', profile.products_count],
        ] as const
      ).map(([key, label, count]) => {
        const on = tab === key;
        return (
          <Pressable
            key={key}
            onPress={() => {
              setTab(key);
              setExpandedId(null);
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            accessibilityLabel={`${label}, ${count}`}
          >
            <Text variant="callout" weight="700" color={on ? dark.text : dark.textTertiary} style={{ fontSize: 13 }}>
              {label}{' '}
              <Text variant="micro" weight="500" color={on ? dark.textSecondary : dark.textTertiary} style={{ fontSize: 11 }}>
                {count}
              </Text>
            </Text>
            {on ? <View style={styles.tabLine} /> : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: dark.background }} onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>
      <FlatList<Item>
        data={data}
        keyExtractor={(item, i) => (item.type === 'post' || item.type === 'expanded' ? `${item.type}-${item.post.id}` : item.type === 'row' ? item.items.map((p) => p.id).join('-') : `${item.type}-${i}`)}
        ListHeaderComponent={header}
        stickyHeaderIndices={locked ? undefined : [1]}
        renderItem={({ item }) => {
          if (item.type === 'tabs') return tabs;
          if (item.type === 'post') return <PostPreview post={item.post} onPress={() => setExpandedId(item.post.id)} />;
          if (item.type === 'expanded')
            return (
              <View>
                <Pressable onPress={() => setExpandedId(null)} style={styles.backToList} accessibilityRole="button">
                  <ArrowLeft size={16} color={dark.mint} />
                  <Text variant="callout" weight="700" tone="mint" style={{ fontSize: 13 }}>
                    Toutes les publications
                  </Text>
                </Pressable>
                <PostCard post={item.post} showReason={false} showPinned />
              </View>
            );
          if (item.type === 'row')
            return (
              <View style={styles.gridRow}>
                {item.items.map((p) => (
                  <ListingCard key={p.id} product={p} width={itemW} showSeller={false} showPinned tone="dark" />
                ))}
              </View>
            );
          if (item.type === 'more')
            return (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <Button label={item.label} variant="outlineDark" pill onPress={item.onPress} />
              </View>
            );
          return tab === 'posts' ? (
            posts.isError ? (
              <ErrorState tone="dark" message={toFrenchError(posts.error)} onRetry={() => posts.refetch()} />
            ) : (
              <View style={styles.emptyTab}>
                <Text variant="callout" tone="fogSecondary" align="center">
                  Aucune publication pour l’instant.
                </Text>
                {isSelf ? <Button label="Publier" variant="cta" pill size="sm" onPress={() => router.push('/publish/post')} style={{ marginTop: spacing.md }} /> : null}
              </View>
            )
          ) : (
            <View style={styles.emptyTab}>
              <Text variant="callout" tone="fogSecondary" align="center">
                {isSelf ? 'Votre boutique apparaît avec votre premier article. Gratuite, sans abonnement.' : 'Pas encore d’article.'}
              </Text>
              {isSelf ? <Button label="Ajouter un article" variant="cta" pill size="sm" icon={Plus} onPress={() => router.push('/publish/listing')} style={{ marginTop: spacing.md }} /> : null}
            </View>
          );
        }}
        ListFooterComponent={
          (tab === 'posts' && (posts.isPending || posts.isFetchingNextPage)) || (tab === 'boutique' && products.isPending) ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Skeleton tone="dark" height={66} radius={12} />
              <Skeleton tone="dark" height={66} radius={12} />
            </View>
          ) : undefined
        }
        contentContainerStyle={[{ paddingBottom: isOwnTab ? dockSpace : spacing.xxxl + insets.bottom }, desktop && { width: '100%', maxWidth: 960, alignSelf: 'center' }]}
        indicatorStyle="white"
      />

      <Sheet visible={shareSheet} onClose={() => setShareSheet(false)} title={isSelf ? 'Partager mon profil' : 'Partager ce profil'} tone="dark">
        <SheetAction
          icon={MessageCircle}
          label="Envoyer sur WhatsApp"
          onPress={() => {
            setShareSheet(false);
            whatsappLinks.profile(profile.handle, profile.display_name);
          }}
        />
        <SheetAction
          icon={Link2}
          label="Partager le lien…"
          onPress={() => {
            setShareSheet(false);
            shareLinks.profile(profile.handle, profile.display_name);
          }}
        />
      </Sheet>

      <Sheet visible={reviewsSheet} onClose={() => setReviewsSheet(false)} title="Avis" scroll>
        <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
          Un avis ne peut être laissé qu’après un échange déclaré terminé par les deux membres. Jëfëli ne vérifie pas la transaction elle-même.
        </Text>
        {reviews.isPending ? (
          <Skeleton height={48} />
        ) : (reviews.data ?? []).length === 0 ? (
          <Text variant="bodyStrong">Pas encore d’avis</Text>
        ) : (
          ((reviews.data ?? []) as unknown as { id: string; rating: number; body: string; created_at: string; reviewer: { display_name: string; avatar_path: string | null } | null }[]).map((rv) => (
            <View key={rv.id} style={styles.review}>
              <Avatar path={rv.reviewer?.avatar_path} name={rv.reviewer?.display_name ?? '?'} size={32} />
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="700">
                  {rv.reviewer?.display_name ?? 'Membre'} · {'★'.repeat(rv.rating)}
                  <Text variant="callout" tone="tertiary">
                    {'★'.repeat(5 - rv.rating)}
                  </Text>
                </Text>
                {rv.body ? <Text variant="callout">{rv.body}</Text> : null}
                <Text variant="caption" tone="secondary">
                  {timeAgo(rv.created_at)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Sheet>

      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={profile.id}
        ownerName={profile.display_name}
        target={{ type: 'profile', id: profile.id }}
        onShare={() => shareLinks.profile(profile.handle, profile.display_name)}
      />
    </View>
  );
}

/** Lovable compact publication preview: thumbnail (or motif), gold label, two lines, meta. */
function PostPreview({ post, onPress }: { post: PostCardData; onPress: () => void }) {
  const intent = isPostIntent(post.intent) ? post.intent : 'share';
  // A narration never stands for the publication; a voice-only one gets the microphone tile.
  const media = post.media.find((m) => m.kind !== 'audio') ?? post.media[0];
  const voiceOnly = media?.kind === 'audio';
  const label = `${post.pinned_at ? 'Épinglé · ' : ''}${intent === 'share' ? (voiceOnly ? 'Publication vocale' : 'Publication') : INTENT_LABELS[intent]}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.preview, pressed && { backgroundColor: dark.subtle }]} accessibilityRole="button" accessibilityLabel={`${label}. ${post.body || 'Voir la publication'}`}>
      {media ? (
        <Thumb bucket={media.bucket === 'private-media' ? 'private-media' : 'public-media'} media={media} style={styles.previewThumb} />
      ) : (
        <View style={[styles.previewThumb, styles.previewMotif]}>
          <Motif />
          <MessageCircle size={20} color={dark.mint} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="micro" weight="600" tone="gold" style={{ fontSize: 11 }}>
          {label}
        </Text>
        <Text variant="caption" weight="500" color={dark.textStrong} numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, marginTop: 3 }}>
          {post.body || 'Voir la publication'}
        </Text>
        <Text variant="micro" tone="fogTertiary" style={{ fontSize: 11, marginTop: 3 }}>
          {timeAgo(post.created_at)} · {post.comment_count} commentaire{post.comment_count > 1 ? 's' : ''}
        </Text>
      </View>
      <ChevronRight size={16} color={dark.textTertiary} />
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Text variant="caption" style={{ fontSize: 12 }}>
      <Text variant="caption" tone="fogTertiary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      {'  '}
      <Text variant="caption" tone="fog" style={{ fontSize: 12 }}>
        {value}
      </Text>
    </Text>
  );
}

function InfoLink({ icon: Icon, label, onPress }: { icon: typeof Star; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.infoLink} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={14} color={dark.mint} />
      <Text variant="caption" weight="600" tone="fog" style={{ flex: 1, fontSize: 12 }}>
        {label}
      </Text>
      <ChevronRight size={14} color={dark.textTertiary} />
    </Pressable>
  );
}

function BoutiqueInfo({ boutique, isSelf }: { boutique: { description: string; pickup_notes: string; delivery_notes: string; payment_notes: string } | null | undefined; isSelf: boolean }) {
  const rows = boutique
    ? [
        { label: 'À propos', value: boutique.description },
        { label: 'Retrait', value: boutique.pickup_notes },
        { label: 'Livraison', value: boutique.delivery_notes },
        { label: 'Paiement (convenu entre vous)', value: boutique.payment_notes },
      ].filter((r) => r.value)
    : [];
  if (rows.length === 0 && !isSelf) return null;
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <InfoRow key={r.label} label={r.label} value={r.value} />
      ))}
      {isSelf ? <InfoLink icon={Store} label={rows.length ? 'Modifier les infos boutique' : 'Ajouter les infos de la boutique'} onPress={() => router.push('/boutique-edit')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  coverBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  presentation: { paddingHorizontal: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, marginTop: -32 },
  avatarRing: { width: 72, height: 72, borderRadius: 36, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: dark.background, alignItems: 'center', justifyContent: 'center' },
  boutiqueChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '58%', marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: dark.goldLine, backgroundColor: dark.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  name: { fontSize: 27, lineHeight: 31, flexShrink: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2, marginTop: 4 },
  bio: { marginTop: spacing.md, maxWidth: 420, fontSize: 15, lineHeight: 22.5 },
  overline: { fontSize: 11, letterSpacing: 1.3, marginBottom: spacing.sm },
  interests: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  interest: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: dark.mintLine, backgroundColor: dark.mintSoft },
  interestMore: { minHeight: 32, paddingHorizontal: 8, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  follow: { flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: dark.borderStrong },
  followOn: { borderColor: dark.mintLine, backgroundColor: dark.mintSelected },
  roundAction: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: dark.borderStrong },
  infoToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  infoToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  info: { gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, marginTop: 4 },
  infoLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  tabs: { flexDirection: 'row', marginTop: spacing.lg, paddingHorizontal: spacing.lg, backgroundColor: dark.header, borderTopWidth: 1, borderBottomWidth: 1, borderColor: dark.border },
  tab: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  tabLine: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0, height: 2, borderRadius: 1, backgroundColor: colors.mint },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 82, paddingVertical: spacing.sm, marginHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: dark.border },
  previewThumb: { width: 66, height: 66, borderRadius: 12 },
  previewMotif: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  backToList: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  emptyTab: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, alignItems: 'center' },
  review: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
});
