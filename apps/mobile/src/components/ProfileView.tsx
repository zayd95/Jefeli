import { formatCount, formatXOF, plural, timeAgo, toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Check,
  ChevronLeft,
  Clock,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Radio,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  Store,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  IconButton,
  LiveBadge,
  radius,
  Screen,
  Skeleton,
  spacing,
  StoryRing,
  Tag,
  Text,
  useToast,
} from '@/design';
import { fetchLiveByHost } from '@/lib/api/live';
import { openConversationWith } from '@/lib/api/messages';
import { fetchReviews } from '@/lib/api/offers';
import { fetchUserPosts } from '@/lib/api/posts';
import { fetchBoutique, fetchSellerProducts } from '@/lib/api/products';
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
import { avatarUrl } from '@/lib/media';
import { shareLinks } from '@/lib/share';
import type { PostCardData, ProductCard, ProfileRow } from '@/lib/types';

import { ContentMenu, confirmAsync } from './ContentMenu';
import { gridItemWidth, ListingCard } from './ListingCard';
import { Thumb } from './Media';
import { PostCard } from './PostCard';
import { ProfileName } from './ProfileName';
import { goBack } from '@/lib/nav';

type Tab = 'fil' | 'statuts' | 'live' | 'boutique' | 'avis';
const TABS: { key: Tab; label: string }[] = [
  { key: 'fil', label: 'Fil' },
  { key: 'statuts', label: 'Statuts' },
  { key: 'live', label: 'Live' },
  { key: 'boutique', label: 'Boutique' },
  { key: 'avis', label: 'Avis' },
];

export function ProfileView({ profile, isOwnTab }: { profile: ProfileRow; isOwnTab?: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const isSelf = userId === profile.id;
  const [tab, setTab] = useState<Tab>('fil');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const rel = useQuery({ queryKey: ['relationship', profile.id], queryFn: () => getRelationship(profile.id), enabled: !isSelf });
  const r: Relationship = rel.data ?? { authenticated: true };
  const locked = !isSelf && profile.is_private && r.follow_status !== 'accepted' && !r.is_friend;

  const products = useQuery({
    queryKey: ['seller-products', profile.id, isSelf],
    queryFn: () => fetchSellerProducts(profile.id, { includeSold: true }),
    enabled: !locked,
  });
  const boutique = useQuery({ queryKey: ['boutique', profile.id], queryFn: () => fetchBoutique(profile.id), enabled: !locked });
  const stories = useQuery({ queryKey: ['active-stories', profile.id], queryFn: () => fetchActiveStories(profile.id), enabled: !locked });
  const highlights = useQuery({ queryKey: ['highlights', profile.id], queryFn: () => fetchHighlights(profile.id), enabled: !locked });
  const posts = useInfiniteQuery({
    queryKey: ['user-posts', profile.id],
    enabled: !locked && tab === 'fil',
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchUserPosts(userId, profile.id, pageParam),
    getNextPageParam: (last) => (last.length < 12 ? undefined : last[last.length - 1]?.created_at),
  });
  const lives = useQuery({ queryKey: ['host-lives', profile.id], queryFn: () => fetchLiveByHost(profile.id), enabled: !locked && tab === 'live' });
  const reviews = useQuery({ queryKey: ['reviews', profile.id], queryFn: () => fetchReviews(profile.id), enabled: !locked && tab === 'avis' });

  const productList = useMemo(() => products.data ?? [], [products.data]);
  const available = productList.filter((p) => p.status === 'active' || p.status === 'reserved');
  const isLiveNow = (lives.data ?? []).some((l) => l.status === 'live');

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

  const followLabel =
    r.follow_status === 'accepted' ? 'Abonné(e)' : r.follow_status === 'pending' ? 'Demande envoyée' : r.follows_me ? 'Suivre en retour' : 'Suivre';

  const friendButton = () => {
    if (isSelf || r.blocked) return null;
    if (r.is_friend)
      return (
        <IconButton
          icon={Users}
          label="Ami(e) — retirer des amis"
          variant="surface"
          onPress={async () => {
            if (await confirmAsync('Retirer des amis ?', `${profile.display_name} ne verra plus vos contenus réservés aux amis.`, 'Retirer'))
              act('friend', () => removeFriend(profile.id), 'Retiré(e) de vos amis');
          }}
        />
      );
    if (r.friend_request_direction === 'incoming' && r.friend_request_id)
      return (
        <Button
          label="Accepter l’ami"
          variant="cta"
          size="sm"
          icon={Check}
          loading={busy === 'friend'}
          onPress={() => act('friend', () => respondFriendRequest(r.friend_request_id as string, true), 'Vous êtes maintenant amis')}
        />
      );
    if (r.friend_request_direction === 'outgoing' && r.friend_request_id)
      return (
        <IconButton
          icon={Clock}
          label="Demande d’ami envoyée — annuler"
          variant="surface"
          onPress={() => act('friend', () => cancelFriendRequest(r.friend_request_id as string), 'Demande annulée')}
        />
      );
    return (
      <IconButton
        icon={UserPlus}
        label="Ajouter en ami"
        variant="surface"
        onPress={() => act('friend', () => sendFriendRequest(profile.id), 'Demande d’ami envoyée')}
      />
    );
  };

  const coverUri = avatarUrl(profile.cover_path);
  const avgRating = profile.rating_count > 0 ? profile.rating_sum / profile.rating_count : null;

  const header = (
    <View>
      <View style={styles.topBar}>
        {isOwnTab ? (
          <View style={{ width: 44 }} />
        ) : (
          <IconButton icon={ChevronLeft} label="Retour" size={26} onPress={() => goBack()} />
        )}
        <Text variant="headline" weight="700">
          {isSelf ? 'Mon profil' : 'Profil'}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon={Share2} label="Partager le profil" onPress={() => shareLinks.profile(profile.handle, profile.display_name)} />
          {isSelf ? (
            <IconButton icon={Settings} label="Réglages" onPress={() => router.push('/settings')} />
          ) : (
            <IconButton icon={MoreHorizontal} label="Plus d’options" onPress={() => setMenu(true)} />
          )}
        </View>
      </View>

      <View style={styles.cover}>
        {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={styles.avatarWrap}>
          <Pressable
            disabled={!(stories.data?.length ?? 0)}
            onPress={() => router.push(`/statut/${profile.id}`)}
            accessibilityLabel={stories.data?.length ? 'Voir ses statuts' : undefined}
            style={[styles.avatarRing, (stories.data?.length ?? 0) > 0 && { borderColor: isLiveNow ? colors.live : colors.accentDeep }]}
          >
            <Avatar path={profile.avatar_path} name={profile.display_name} size={84} />
          </Pressable>
        </View>
      </View>

      <View style={styles.identity}>
        <ProfileName profile={profile} variant="title" numberOfLines={2} />
        <Text variant="callout" tone="secondary">
          @{profile.handle}
          {profile.city ? ` · ${[profile.neighborhood, profile.city].filter(Boolean).join(', ')}` : ''}
        </Text>
        {profile.is_merchant || profile.verification_level === 'merchant_verified' ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {profile.verification_level === 'merchant_verified' ? <Tag label="Vendeur vérifié" tone="mint" /> : <Tag label="Vendeur" />}
          </View>
        ) : null}
        {profile.bio ? <Text style={{ marginTop: spacing.xs }}>{profile.bio}</Text> : null}

        <View style={styles.stats}>
          <Stat value={profile.products_count} label={plural(profile.products_count, 'Article', 'Articles')} onPress={() => setTab('boutique')} />
          <Stat value={profile.followers_count} label={plural(profile.followers_count, 'Abonné', 'Abonnés')} onPress={locked ? undefined : () => router.push({ pathname: '/connections/[userId]', params: { userId: profile.id, kind: 'followers' } })} />
          <Stat value={profile.following_count} label={plural(profile.following_count, 'Abonnement', 'Abonnements')} onPress={locked ? undefined : () => router.push({ pathname: '/connections/[userId]', params: { userId: profile.id, kind: 'following' } })} />
          <Stat value={profile.friends_count} label={plural(profile.friends_count, 'Ami', 'Amis')} onPress={locked ? undefined : () => router.push({ pathname: '/connections/[userId]', params: { userId: profile.id, kind: 'friends' } })} />
        </View>

        {isSelf ? (
          <View style={styles.actions}>
            <Button label="Modifier le profil" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/edit-profile')} />
            <Button label="Vendre un article" variant="primary" icon={ShoppingBag} style={{ flex: 1 }} onPress={() => router.push('/publish/listing')} />
          </View>
        ) : r.blocked ? (
          <Text tone="secondary" style={{ marginTop: spacing.md }}>
            Vous avez bloqué ce compte. Débloquez-le depuis Réglages › Comptes bloqués.
          </Text>
        ) : (
          <View style={styles.actions}>
            <Button
              label={followLabel}
              variant={r.follow_status ? 'outline' : 'primary'}
              style={{ flex: 1 }}
              loading={busy === 'follow'}
              onPress={() =>
                act(
                  'follow',
                  () => (r.follow_status ? unfollow(userId ?? '', profile.id) : follow(userId ?? '', profile.id)),
                  r.follow_status ? undefined : profile.is_private ? 'Demande d’abonnement envoyée' : undefined,
                )
              }
            />
            <Button label="Message" variant="outline" icon={MessageCircle} style={{ flex: 1 }} loading={busy === 'message'} onPress={startChat} />
            {friendButton()}
          </View>
        )}
      </View>

      {locked ? (
        <EmptyState icon={Lock} title="Ce compte est privé" body="Abonnez-vous pour voir ses publications, ses statuts et sa boutique." />
      ) : (
        <>
          {(stories.data?.length ?? 0) > 0 || (highlights.data?.length ?? 0) > 0 ? (
            <View style={{ paddingTop: spacing.lg }}>
              <Text variant="headline" weight="800" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
                {isSelf ? 'Mes statuts' : 'Ses statuts'}
              </Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}
                data={[
                  ...((stories.data?.length ?? 0) > 0 ? [{ id: 'active', title: 'En cours', path: profile.avatar_path, active: true }] : []),
                  ...(highlights.data ?? []).map((h) => ({ id: h.id, title: h.title, path: null as string | null, active: false, cover: h.items[0]?.story })),
                ]}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) =>
                  item.active ? (
                    <StoryRing path={item.path} name={profile.display_name} label={item.title} onPress={() => router.push(`/statut/${profile.id}`)} />
                  ) : (
                    <HighlightBubble id={item.id} title={item.title} coverPath={(item as { cover?: { poster_path: string | null; storage_path: string; media_kind: string } }).cover} />
                  )
                }
              />
            </View>
          ) : null}

          <BoutiquePreview
            isSelf={isSelf}
            products={available}
            loading={products.isPending}
            onSeeAll={() => setTab('boutique')}
          />

          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((t) => (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
                <Text variant="callout" weight={tab === t.key ? '700' : '500'} tone={tab === t.key ? 'default' : 'secondary'}>
                  {t.label}
                </Text>
                {tab === t.key ? <View style={styles.tabLine} /> : null}
              </Pressable>
            ))}
          </View>

          {tab === 'boutique' ? <BoutiqueInfo boutique={boutique.data} isSelf={isSelf} /> : null}
          {tab === 'statuts' ? <StatusesTab isSelf={isSelf} storiesCount={stories.data?.length ?? 0} highlights={highlights.data ?? []} profileId={profile.id} /> : null}
          {tab === 'live' ? (
            lives.isPending ? (
              <Skeleton height={80} style={{ margin: spacing.lg }} />
            ) : (lives.data ?? []).length === 0 ? (
              <EmptyState compact icon={Radio} title="Aucun live pour l’instant" body={isSelf ? 'Lancez un live depuis le bouton Publier quand le direct sera activé.' : 'Ses prochains lives apparaîtront ici.'} />
            ) : (
              (lives.data ?? []).map((l) => (
                <Pressable key={l.id} style={styles.liveItem} onPress={() => l.status === 'live' && router.push(`/live/${l.id}`)} disabled={l.status !== 'live'}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{l.title}</Text>
                    <Text variant="caption" tone="secondary">
                      {l.status === 'live' ? 'En cours' : l.status === 'ended' ? `Terminé · ${timeAgo(l.ended_at ?? l.created_at)}` : 'En préparation'}
                    </Text>
                  </View>
                  {l.status === 'live' ? <LiveBadge compact /> : null}
                </Pressable>
              ))
            )
          ) : null}
          {tab === 'avis' ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <Card>
                {avgRating !== null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Star size={22} color={colors.ink} fill={colors.ink} />
                    <Text variant="title">{avgRating.toFixed(1).replace('.', ',')}</Text>
                    <Text tone="secondary">
                      {profile.rating_count} avis
                    </Text>
                  </View>
                ) : (
                  <Text variant="bodyStrong">Pas encore d’avis</Text>
                )}
                <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
                  Un avis ne peut être laissé qu’après un échange déclaré terminé par les deux membres. Jëfëli ne vérifie pas la transaction elle-même.
                </Text>
              </Card>
              {((reviews.data ?? []) as unknown as { id: string; rating: number; body: string; created_at: string; reviewer: { display_name: string; avatar_path: string | null } | null }[]).map((rv) => (
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
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const rows = useMemo(() => {
    const out: ProductCard[][] = [];
    for (let i = 0; i < productList.length; i += 2) out.push(productList.slice(i, i + 2));
    return out;
  }, [productList]);

  const data: (PostCardData | ProductCard[])[] = locked ? [] : tab === 'fil' ? (posts.data?.pages.flat() ?? []) : tab === 'boutique' ? rows : [];
  const itemW = gridItemWidth(width);

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item, i) => (Array.isArray(item) ? `row-${i}` : item.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          Array.isArray(item) ? (
            <View style={styles.gridRow}>
              {item.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} showSeller={false} />
              ))}
            </View>
          ) : (
            <PostCard post={item} showReason={false} />
          )
        }
        ListEmptyComponent={
          locked ? undefined : tab === 'fil' ? (
            posts.isPending ? (
              <Skeleton height={240} style={{ margin: spacing.lg }} />
            ) : posts.isError ? (
              <ErrorState message={toFrenchError(posts.error)} onRetry={() => posts.refetch()} />
            ) : (
              <EmptyState compact icon={MessageCircle} title="Aucune publication" body={isSelf ? 'Partagez une photo, une nouveauté ou une pensée du jour.' : undefined} actionLabel={isSelf ? 'Publier' : undefined} onAction={isSelf ? () => router.push('/publish/post') : undefined} />
            )
          ) : tab === 'boutique' && !products.isPending ? (
            <EmptyState
              compact
              icon={Store}
              title={isSelf ? 'Votre boutique est vide' : 'Aucun article pour le moment'}
              body={isSelf ? 'Publiez votre premier article : votre boutique apparaîtra automatiquement ici, sans configuration.' : undefined}
              actionLabel={isSelf ? 'Ajouter un article' : undefined}
              onAction={isSelf ? () => router.push('/publish/listing') : undefined}
            />
          ) : undefined
        }
        onEndReached={() => tab === 'fil' && posts.hasNextPage && !posts.isFetchingNextPage && posts.fetchNextPage()}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      />
      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={profile.id}
        ownerName={profile.display_name}
        target={{ type: 'profile', id: profile.id }}
        onShare={() => shareLinks.profile(profile.handle, profile.display_name)}
      />
    </Screen>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ minWidth: 60 }} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${value} ${label}`}>
      <Text variant="headline" weight="800">
        {formatCount(value)}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

function HighlightBubble({ id, title, coverPath }: { id: string; title: string; coverPath?: { poster_path: string | null; storage_path: string; media_kind: string } | null }) {
  return (
    <Pressable onPress={() => router.push(`/highlight/${id}`)} style={{ alignItems: 'center', width: 72 }} accessibilityRole="button" accessibilityLabel={`Voir la sélection ${title}`}>
      <View style={styles.highlightRing}>
        <Thumb bucket="private-media" media={coverPath ? { storage_path: coverPath.storage_path, poster_path: coverPath.poster_path, kind: coverPath.media_kind } : null} style={{ width: 60, height: 60, borderRadius: 30 }} />
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 6, fontSize: 11.5 }}>
        {title}
      </Text>
    </Pressable>
  );
}

function BoutiquePreview({ isSelf, products, loading, onSeeAll }: { isSelf: boolean; products: ProductCard[]; loading: boolean; onSeeAll: () => void }) {
  if (loading) return <Skeleton height={150} style={{ margin: spacing.lg }} radius={14} />;
  if (products.length === 0) {
    if (!isSelf) return null;
    return (
      <Pressable onPress={() => router.push('/publish/listing')} style={[styles.shop, styles.shopEmpty]} accessibilityRole="button">
        <Store size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Votre boutique</Text>
          <Text variant="caption" tone="secondary">
            Elle se crée automatiquement avec votre premier article. Gratuit, sans abonnement.
          </Text>
        </View>
        <Text variant="callout" weight="700">
          Ajouter →
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.shop}>
      <View style={styles.shopHeader}>
        <Text variant="headline" weight="800">
          {isSelf ? 'Ma boutique' : 'Sa boutique'}
        </Text>
        <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button">
          <Text variant="callout" weight="600" tone="secondary">
            Tout voir →
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {products.slice(0, 3).map((p) => (
          <Pressable key={p.id} style={{ flex: 1 }} onPress={() => router.push(`/p/${p.id}`)} accessibilityRole="button" accessibilityLabel={p.title}>
            <Thumb media={p.media[0]} style={{ height: 96, borderRadius: radius.sm }} />
            <Text variant="caption" weight="800" style={{ marginTop: 5 }} numberOfLines={1}>
              {p.price_xof !== null ? formatXOF(p.price_xof, { compact: true }) : 'Troc'}
            </Text>
          </Pressable>
        ))}
        {products.length < 3 ? Array.from({ length: 3 - products.length }).map((_, i) => <View key={i} style={{ flex: 1 }} />) : null}
      </View>
    </View>
  );
}

function BoutiqueInfo({ boutique, isSelf }: { boutique: { description: string; pickup_notes: string; delivery_notes: string; payment_notes: string } | null | undefined; isSelf: boolean }) {
  if (!boutique) return null;
  const rows = [
    { label: 'À propos', value: boutique.description },
    { label: 'Retrait', value: boutique.pickup_notes },
    { label: 'Livraison', value: boutique.delivery_notes },
    { label: 'Paiement (convenu entre vous)', value: boutique.payment_notes },
  ].filter((r) => r.value);
  if (rows.length === 0 && !isSelf) return null;
  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.label}>
          <Text variant="caption" tone="secondary" weight="600">
            {r.label}
          </Text>
          <Text variant="callout">{r.value}</Text>
        </View>
      ))}
      {isSelf ? <Button label={rows.length ? 'Modifier les infos boutique' : 'Ajouter les infos de la boutique'} variant="soft" size="sm" onPress={() => router.push('/boutique-edit')} /> : null}
    </View>
  );
}

function StatusesTab({ isSelf, storiesCount, highlights, profileId }: { isSelf: boolean; storiesCount: number; highlights: { id: string; title: string; items: unknown[] }[]; profileId: string }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      {storiesCount > 0 ? <Button label={`Voir ${storiesCount} statut${storiesCount > 1 ? 's' : ''} en cours`} variant="soft" onPress={() => router.push(`/statut/${profileId}`)} /> : null}
      {highlights.length === 0 ? (
        <Text tone="secondary" variant="callout">
          {isSelf ? 'Vos statuts disparaissent après 24 h. Ajoutez-les à une sélection pour les garder sur votre profil.' : 'Aucune sélection de statuts.'}
        </Text>
      ) : (
        highlights.map((h) => (
          <Pressable key={h.id} onPress={() => router.push(`/highlight/${h.id}`)} style={styles.liveItem}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {h.title}
            </Text>
            <Text variant="caption" tone="secondary">
              {h.items.length} statut{h.items.length > 1 ? 's' : ''}
            </Text>
          </Pressable>
        ))
      )}
      {isSelf ? <Button label="Publier un statut" variant="cta" onPress={() => router.push('/publish/status')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, height: 52 },
  cover: { height: 120, backgroundColor: '#C9DCD2', marginHorizontal: spacing.sm, borderRadius: radius.lg, overflow: 'visible' },
  avatarWrap: { position: 'absolute', left: spacing.lg, bottom: -42 },
  avatarRing: { borderRadius: 50, borderWidth: 3, borderColor: colors.background, padding: 2, backgroundColor: colors.background },
  identity: { paddingHorizontal: spacing.lg, paddingTop: 52, gap: 2 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignItems: 'center' },
  shop: { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  shopEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', marginTop: spacing.xl, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, minHeight: 44 },
  tabLine: { position: 'absolute', bottom: -1, height: 3, width: 36, borderRadius: 2, backgroundColor: colors.action },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  highlightRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  liveItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  review: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
});

