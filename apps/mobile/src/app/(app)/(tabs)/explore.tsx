/**
 * Explorer, the white commercial page (owner, 12 Nov 2026): a dark editorial intro (forest night
 * with the woven motif, serif title, city pill, search) over a near-white body with white cards.
 *   1. Where: the city pill (all cities, my city, or an active city) — sheet of real cities
 *   2. Category: tiles in one horizontal row, « Tous » first; the active one in gold
 *   3. What: Tout · Neuf · Occasion · Wecci pills, plus « Filtres » (price range, to buy / Wecci,
 *      sort) in a sheet with tap-only choices
 *   4. Without filters: « Tendances cette semaine » (articles most saved as favourites by
 *      different members, real data) and « Vendeurs à suivre » (real sellers not followed yet);
 *      each row is hidden when it has nothing real to show.
 * Data: explore_products / trending_products / suggested_sellers
 * (supabase/migrations/20261113000100_explore_discovery.sql).
 * Home's discovery chips open Explorer with `?kind=trade|used`.
 */
import { formatXOF, toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, Flame, Globe2, LayoutGrid, MapPin, Megaphone, Navigation, PackageSearch, Search, SlidersHorizontal, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { Avatar, Button, colors, dark, DemoBadge, ErrorState, Eyebrow, Motif, radius, Screen, Sheet, SheetAction, Skeleton, spacing, Text, useToast, VerifiedBadge } from '@/design';
import {
  exploreMarket,
  fetchActiveCities,
  fetchCategories,
  fetchMarketCounts,
  fetchSuggestedSellers,
  fetchTrendingProducts,
  PRODUCT_PAGE,
  type BrowseMode,
  type ExploreOffer,
  type ExploreSort,
  type SuggestedSeller,
} from '@/lib/api/products';
import { follow } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';
import { useDockSpace } from '@/lib/dock';
import { STUDIO } from '@/lib/studioLinks';
import { useDockScroll } from '@/lib/dockVisibility';
import { useLayout } from '@/lib/layout';
import { aisleCounts, LAUNCH_AISLES, otherAisles, type Aisle } from '@/lib/market';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { ProductCard } from '@/lib/types';

type Kind = 'all' | 'new' | 'used' | 'trade';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'new', label: 'Neuf' },
  { key: 'used', label: 'Occasion' },
  { key: 'trade', label: 'Troquer' },
];
const isKind = (v: unknown): v is Kind => v === 'all' || v === 'new' || v === 'used' || v === 'trade';

function browseArgs(kind: Kind): { mode: BrowseMode; condition: string | null } {
  if (kind === 'new') return { mode: 'recent', condition: 'new' };
  if (kind === 'used') return { mode: 'occasions', condition: null };
  if (kind === 'trade') return { mode: 'troc', condition: null };
  return { mode: 'recent', condition: null };
}

type Row = { type: 'lead'; product: ProductCard } | { type: 'pair'; items: ProductCard[] };

/** Price ranges as plain tap targets (no typing): easier for every reader. */
const PRICES: { key: string; label: string; min: number | null; max: number | null }[] = [
  { key: 'any', label: 'Tous les prix', min: null, max: null },
  { key: 'lt5', label: `Moins de ${formatXOF(5000)}`, min: null, max: 5000 },
  { key: '5-20', label: `${formatXOF(5000).replace(/\s?F CFA$/, '')} à ${formatXOF(20000)}`, min: 5000, max: 20000 },
  { key: '20-50', label: `${formatXOF(20000).replace(/\s?F CFA$/, '')} à ${formatXOF(50000)}`, min: 20000, max: 50000 },
  { key: 'gt50', label: `Plus de ${formatXOF(50000)}`, min: 50000, max: null },
];
const OFFERS: { key: 'all' | 'sale' | 'trade'; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'sale', label: 'Pour acheter' },
  { key: 'trade', label: 'Wecci (échange)' },
];
const SORTS: { key: ExploreSort; label: string }[] = [
  { key: 'recent', label: 'Les plus récents' },
  { key: 'price_asc', label: 'Prix : du moins cher' },
  { key: 'price_desc', label: 'Prix : du plus cher' },
];

/** Desktop grid (W1.4): as many 220–280 px columns as fit, 3 to 5. */
const DESKTOP_MAX = 1240;
const DESKTOP_PAD = 32;
const DESKTOP_GAP = 18;
function desktopColumns(contentWidth: number): number {
  return Math.max(3, Math.min(5, Math.floor((Math.min(contentWidth, DESKTOP_MAX) - DESKTOP_PAD * 2 + DESKTOP_GAP) / (230 + DESKTOP_GAP))));
}

export default function Explore() {
  // The safe-area strip and the intro are Atlantic night, so light status-bar icons.
  useDarkStatusBar();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const dockSpace = useDockSpace();
  const onDockScroll = useDockScroll();
  const { desktop } = useLayout();
  const [contentWidth, setContentWidth] = useState(width);
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(isKind(params.kind) ? params.kind : 'all');
  // P1 market: the aisle (« allée ») replaces the single category; « Près de moi » = my neighbourhood.
  const [category, setCategory] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const hood = profile?.neighborhood?.trim() || null;
  const [city, setCity] = useState<string | null>(null);
  const [citySheet, setCitySheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [price, setPrice] = useState('any');
  const [offer, setOffer] = useState<'all' | 'sale' | 'trade'>('all');
  const [sort, setSort] = useState<ExploreSort>('recent');

  // Home chips (« Wecci · Échange », « Occasions ») land here with ?kind=…: apply it once while
  // rendering, then clear the param so the same chip works again later.
  const [seenKind, setSeenKind] = useState(params.kind);
  if (params.kind !== seenKind) {
    setSeenKind(params.kind);
    if (isKind(params.kind)) {
      setKind(params.kind);
      setCategory(null);
    }
  }
  useEffect(() => {
    if (params.kind) router.setParams({ kind: undefined });
  }, [params.kind]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const cities = useQuery({ queryKey: ['active-cities'], queryFn: fetchActiveCities, staleTime: 5 * 60_000 });

  const { mode, condition } = browseArgs(kind);
  const range = PRICES.find((p) => p.key === price) ?? PRICES[0]!;
  const offerArg: ExploreOffer = offer === 'all' ? null : offer;
  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const aisles = useMemo(() => [...LAUNCH_AISLES, ...otherAisles(cats)], [cats]);
  const aisle: Aisle | null = aisles.find((a) => a.key === category) ?? null;
  const near = nearMe && hood ? hood : null;
  const whereCity = near ? (profile?.city ?? city) : city;
  const counts = useQuery({ queryKey: ['market-counts', whereCity, near], queryFn: () => fetchMarketCounts(whereCity, near), staleTime: 60_000 });
  const products = useInfiniteQuery({
    queryKey: ['explore', kind, category, city, price, offer, sort, near],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      exploreMarket({ categories: aisle?.categories ?? null, neighborhood: near, mode, condition, city: whereCity, minPrice: range.min, maxPrice: range.max, offer: offerArg, sort, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PRODUCT_PAGE ? undefined : all.length * PRODUCT_PAGE),
  });

  const items = useMemo(() => products.data?.pages.flat() ?? [], [products.data]);
  // Lovable rhythm: one large lead card, then two columns.
  const columns = desktop ? desktopColumns(contentWidth) : 2;
  const rows = useMemo<Row[]>(() => {
    if (items.length === 0) return [];
    // Desktop: a plain commerce grid (no lead card), every article the same size.
    if (desktop) {
      const out: Row[] = [];
      for (let i = 0; i < items.length; i += columns) out.push({ type: 'pair', items: items.slice(i, i + columns) });
      return out;
    }
    const out: Row[] = [{ type: 'lead', product: items[0] as ProductCard }];
    for (let i = 1; i < items.length; i += 2) out.push({ type: 'pair', items: items.slice(i, i + 2) });
    return out;
  }, [items, desktop, columns]);
  const itemW = desktop
    ? Math.floor((Math.min(contentWidth, DESKTOP_MAX) - DESKTOP_PAD * 2 - DESKTOP_GAP * (columns - 1)) / columns)
    : gridItemWidth(width, 2, 14, 10);
  const leadW = Math.min(width, 720) - 28;

  const extraFilters = (price !== 'any' ? 1 : 0) + (offer !== 'all' ? 1 : 0) + (sort !== 'recent' ? 1 : 0);
  const filtered = kind !== 'all' || !!category || !!city || !!near || extraFilters > 0;
  const clear = () => {
    setKind('all');
    setCategory(null);
    setNearMe(false);
    setCity(null);
    setPrice('any');
    setOffer('all');
    setSort('recent');
  };
  // Discovery rows only on the plain page: a filtered search shows results only.
  const trending = useQuery({ queryKey: ['trending-products'], queryFn: () => fetchTrendingProducts(10), staleTime: 5 * 60_000, enabled: !filtered });
  const sellers = useQuery({ queryKey: ['suggested-sellers'], queryFn: () => fetchSuggestedSellers(8), staleTime: 5 * 60_000, enabled: !filtered });
  const trendItems = filtered ? [] : (trending.data ?? []);
  const sellerItems = filtered ? [] : (sellers.data ?? []);
  const heading =
    aisle ? `Allée ${aisle.label}` : kind === 'trade' ? 'Wecci · Échange' : near ? `Près de moi · ${near}` : kind === 'used' ? 'Occasions' : kind === 'new' ? 'Articles neufs' : city ? `À ${city}` : 'Nouveautés';
  const countRows = counts.data ?? [];

  const header = (
    <View>
      <View style={[styles.intro, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
        <Motif opacity={0.7} />
        <View style={styles.introTop}>
          <Text serif weight="600" tone="fog" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>
            Explorer
          </Text>
          <Pressable
            onPress={() => setCitySheet(true)}
            style={({ pressed }) => [styles.cityPill, pressed && { transform: [{ scale: 0.96 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`Ville : ${city ?? 'toutes les villes'}. Changer`}
          >
            <View style={styles.cityIcon}>
              <MapPin size={16} color={colors.gold} strokeWidth={2.2} />
            </View>
            <Text variant="callout" weight="600" tone="fog" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>
              {city ?? 'Tout le Sénégal'}
            </Text>
            <ChevronDown size={16} color={dark.textSecondary} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/search')} style={styles.search} accessibilityRole="button" accessibilityLabel="Rechercher">
          <Search size={20} color={dark.textSecondary} />
          <Text variant="body" color={dark.textSecondary} numberOfLines={1}>
            Un article, une boutique, un quartier…
          </Text>
        </Pressable>
      </View>

      <View style={[styles.market, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityLabel="Les allées du marché">
        <Eyebrow label="Les allées du marché" />
        <View style={[styles.launchRow, desktop && { maxWidth: 760 }]}>
          {LAUNCH_AISLES.map((a) => (
            <AisleCard key={a.key} aisle={a} counts={aisleCounts(a, countRows)} selected={category === a.key} onPress={() => setCategory(category === a.key ? null : a.key)} />
          ))}
        </View>
      </View>
      <ScrollView horizontal={!desktop} scrollEnabled={!desktop} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tiles, desktop && styles.tilesWrap]} accessibilityLabel="Autres allées">
        <AisleChip icon={LayoutGrid} label="Tout le marché" selected={!category} onPress={() => setCategory(null)} />
        {aisles
          .filter((a) => !a.launch)
          .map((a) => (
            <AisleChip key={a.key} icon={a.icon} label={a.label} a11y={a.hint} count={aisleCounts(a, countRows).articles} selected={category === a.key} onPress={() => setCategory(category === a.key ? null : a.key)} />
          ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pills, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityRole="tablist">
        <Pressable
          onPress={() => setFilterSheet(true)}
          hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [styles.pill, styles.filterPill, extraFilters > 0 && styles.pillOn, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityRole="button"
          accessibilityLabel={extraFilters > 0 ? `Filtres, ${extraFilters} actif${extraFilters > 1 ? 's' : ''}` : 'Filtres : prix, achat ou Wecci, tri'}
        >
          <SlidersHorizontal size={15} color={extraFilters > 0 ? colors.ink : colors.ink} strokeWidth={2.2} />
          <Text variant="callout" weight="700" color={extraFilters > 0 ? colors.ink : colors.ink} style={{ fontSize: 13 }}>
            {extraFilters > 0 ? `Filtres · ${extraFilters}` : 'Filtres'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => (hood ? setNearMe(!nearMe) : router.push('/edit-profile'))}
          hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [styles.pill, styles.filterPill, !!near && styles.pillOn, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityRole="button"
          accessibilityState={{ selected: !!near }}
          accessibilityLabel={hood ? `Près de moi, ${hood}` : 'Près de moi : ajoutez votre quartier à votre profil'}
          testID="near-me"
        >
          <Navigation size={14} color={near ? colors.ink : dark.wecci} strokeWidth={2.4} />
          <Text variant="callout" weight="700" color={near ? colors.ink : colors.ink} style={{ fontSize: 13 }}>
            {hood ? `Près de moi · ${hood}` : 'Près de moi'}
          </Text>
        </Pressable>
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              accessibilityLabel={k.label}
            >
              <Text variant="callout" weight="600" color={on ? colors.ink : dark.textSecondary} style={{ fontSize: 13 }}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {trendItems.length > 0 ? (
        <View style={styles.discovery}>
          <View style={[styles.rowHead, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            <Flame size={18} color={colors.red} strokeWidth={2.2} />
            <Text serif style={{ fontSize: 22, lineHeight: 27, color: colors.ink }} accessibilityRole="header">
              Tendances cette semaine
            </Text>
          </View>
          <Text variant="caption" style={[styles.rowSub, { color: dark.textSecondary }, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            Les articles que les membres ajoutent le plus à leurs favoris.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rowScroll, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityLabel="Tendances cette semaine">
            {trendItems.map((p) => (
              <ListingCard key={p.id} product={p} width={desktop ? 220 : 168} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {sellerItems.length > 0 ? (
        <View style={styles.discovery}>
          <View style={[styles.rowHead, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            <UserPlus size={18} color={dark.wecci} strokeWidth={2.2} />
            <Text serif style={{ fontSize: 22, lineHeight: 27, color: colors.ink }} accessibilityRole="header">
              Vendeurs à suivre
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rowScroll, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityLabel="Vendeurs à suivre">
            {sellerItems.map((s) => (
              <SellerCard key={s.id} seller={s} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={[styles.sectionHeader, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
        <View style={{ flexShrink: 1, gap: 8 }}>
          <Eyebrow label={filtered ? 'Votre sélection' : 'À découvrir'} />
          <Text serif style={{ fontSize: desktop ? 34 : 29, lineHeight: desktop ? 38 : 33, color: colors.ink, flexShrink: 1 }} numberOfLines={1}>
            {heading}
          </Text>
        </View>
        {filtered ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer les filtres" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text variant="callout" weight="600" color={dark.textSecondary} style={{ textDecorationLine: 'underline', fontSize: 13 }}>
              Effacer
            </Text>
          </Pressable>
        ) : null}
      </View>
      {kind === 'trade' ? (
        <Text variant="callout" color={dark.textSecondary} style={{ paddingHorizontal: 14, marginTop: -spacing.xs, marginBottom: spacing.md }}>
          Wecci : échange possible, avec ou sans complément en argent.
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen background={dark.background}>
      <FlatList<Row>
        onScroll={onDockScroll}
        scrollEventThrottle={16}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        style={{ backgroundColor: dark.background }}
        data={rows}
        keyExtractor={(row) => (row.type === 'lead' ? `lead-${row.product.id}` : row.items.map((p) => p.id).join('-'))}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.type === 'lead' ? (
            <View style={styles.leadRow}>
              <ListingCard product={item.product} width={leadW} big />
            </View>
          ) : (
            <View style={[styles.gridRow, desktop && styles.gridRowDesktop]}>
              {item.items.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} showVerified={desktop} />
              ))}
            </View>
          )
        }
        ListEmptyComponent={
          products.isPending ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }} accessibilityLabel="Chargement">
              <Skeleton height={Math.round((leadW * 11) / 16)} radius={20} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={190} radius={18} />
                    <Skeleton height={14} width="60%" />
                  </View>
                ))}
              </View>
            </View>
          ) : products.isError ? (
            <ErrorState message={toFrenchError(products.error)} onRetry={() => products.refetch()} />
          ) : (
            <SeekInvite
              title={aisle ? `L’allée ${aisle.label} attend ses premiers articles` : near ? `Rien pour l’instant à ${near}` : filtered ? 'Rien pour ces filtres' : 'Le marché ouvre bientôt'}
              onSeek={() => router.push(STUDIO.seek)}
              onClear={filtered ? clear : undefined}
            />
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.ink} />}
        contentContainerStyle={[{ paddingBottom: dockSpace, flexGrow: 1 }, desktop && styles.desktopList]}
      />

      <Sheet visible={citySheet} onClose={() => setCitySheet(false)} title="Ville" scroll tone="dark">
        <SheetAction
          icon={city === null ? Check : Globe2}
          label="Tout le Sénégal"
          onPress={() => {
            setCity(null);
            setCitySheet(false);
          }}
        />
        {profile?.city ? (
          <SheetAction
            icon={city === profile.city ? Check : Navigation}
            label={`Près de moi · ${profile.city}`}
            onPress={() => {
              setCity(profile.city);
              setCitySheet(false);
            }}
          />
        ) : null}
        {(cities.data ?? [])
          .filter((c) => c.city !== profile?.city)
          .map((c) => (
            <SheetAction
              key={c.city}
              icon={city === c.city ? Check : MapPin}
              label={`${c.city} · ${c.listings} article${c.listings > 1 ? 's' : ''}`}
              onPress={() => {
                setCity(c.city);
                setCitySheet(false);
              }}
            />
          ))}
      </Sheet>

      <Sheet visible={filterSheet} onClose={() => setFilterSheet(false)} title="Filtres" scroll tone="dark">
        <FilterGroup title="Prix" options={PRICES.map((p) => ({ key: p.key, label: p.label }))} value={price} onChange={setPrice} />
        <FilterGroup title="Je veux" options={OFFERS} value={offer} onChange={(v) => setOffer(v as typeof offer)} />
        <FilterGroup title="Trier par" options={SORTS} value={sort} onChange={(v) => setSort(v as ExploreSort)} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Effacer"
              variant="outlineDark"
              onPress={() => {
                setPrice('any');
                setOffer('all');
                setSort('recent');
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button label="Voir les articles" variant="cta" onPress={() => setFilterSheet(false)} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

/** One group of tap-only choices in the filter sheet (radio semantics). */
function FilterGroup<K extends string>({ title, options, value, onChange }: { title: string; options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.lg }} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text variant="micro" weight="800" color={dark.textSecondary} style={{ fontSize: 11.5, letterSpacing: 1.2 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={o.label}
            >
              {on ? <Check size={15} color={colors.ink} strokeWidth={2.6} /> : null}
              <Text variant="callout" weight="700" color={on ? colors.ink : dark.text} style={{ fontSize: 14 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** « Vendeurs à suivre » card: real seller, their article count, one-tap follow. */
function SellerCard({ seller }: { seller: SuggestedSeller }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function onFollow() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await follow(userId, seller.id);
      setDone(true);
      void qc.invalidateQueries({ queryKey: ['relationship', seller.id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.seller}>
      <Pressable onPress={() => router.push(`/u/${seller.handle}`)} accessibilityRole="link" accessibilityLabel={`Voir la boutique de ${seller.display_name}`} style={{ alignItems: 'center', gap: 6 }}>
        <Avatar path={seller.avatar_path} name={seller.display_name} size={56} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 132 }}>
          <Text weight="700" color={colors.ink} numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
            {seller.display_name}
          </Text>
          {seller.verification_level === 'merchant_verified' ? <VerifiedBadge size={13} /> : null}
        </View>
        <Text variant="caption" color={dark.textSecondary} numberOfLines={1} style={{ maxWidth: 132 }}>
          {[seller.city, `${seller.active_products} article${seller.active_products > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
        </Text>
        {seller.is_demo ? <DemoBadge /> : null}
      </Pressable>
      <Pressable
        onPress={() => void onFollow()}
        disabled={done || busy}
        style={({ pressed }) => [styles.follow, done && styles.followDone, pressed && { transform: [{ scale: 0.97 }] }]}
        accessibilityRole="button"
        accessibilityLabel={done ? `Vous suivez ${seller.display_name}` : `Suivre ${seller.display_name}`}
      >
        <Text variant="callout" weight="700" color={done ? colors.ink : colors.ink} style={{ fontSize: 13 }}>
          {done ? 'Suivi' : 'Suivre'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Lovable 84-pt category tile: « Tous » on night with the motif, categories on paper. */
/** A launch aisle (Téléphones, Mode): large card with what the aisle holds right now. */
function AisleCard({ aisle, counts, selected, onPress }: { aisle: Aisle; counts: { articles: number; sellers: number }; selected: boolean; onPress: () => void }) {
  const Icon = aisle.icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.aisle, selected ? styles.aisleOn : styles.aislePaper, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={`Allée ${aisle.label}, ${counts.articles} articles`}
      testID={`aisle-${aisle.key}`}
    >
      <View style={[styles.aisleIcon, selected && styles.tileIconOn]}>
        <Icon size={20} color={selected ? colors.gold : dark.wecci} strokeWidth={2} />
      </View>
      <View style={{ gap: 2, flexShrink: 1 }}>
        <Text serif color={selected ? colors.ink : colors.ink} style={{ fontSize: 21, lineHeight: 25 }}>
          {aisle.label}
        </Text>
        <Text variant="caption" weight="600" color={selected ? colors.ink : dark.textSecondary} numberOfLines={2}>
          {counts.articles > 0 ? `${counts.articles} article${counts.articles > 1 ? 's' : ''}\n${counts.sellers} vendeur${counts.sellers > 1 ? 's' : ''}` : 'Bientôt ouverte'}
        </Text>
      </View>
    </Pressable>
  );
}

function AisleChip({ icon: Icon, label, a11y, count, selected, onPress }: { icon: LucideIcon; label: string; a11y?: string; count?: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.tileOn : styles.tilePaper, pressed && { transform: [{ scale: 0.96 }] }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={a11y ?? label}
    >
      <Icon size={16} color={selected ? colors.ink : dark.wecci} strokeWidth={2} />
      <Text weight="600" color={selected ? colors.ink : colors.ink} numberOfLines={1} style={{ fontSize: 13 }}>
        {label}
      </Text>
      {count ? (
        <Text variant="caption" weight="700" color={selected ? colors.ink : dark.textTertiary} style={{ fontSize: 11.5 }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Never an empty aisle (P1): when nothing matches, the market asks what the member is looking for.
 * « Je cherche » is a real publication (posts.intent = 'seek') that sellers can answer.
 */
function SeekInvite({ title, onSeek, onClear }: { title: string; onSeek: () => void; onClear?: () => void }) {
  return (
    <View style={styles.seek} testID="seek-invite">
      <View style={styles.seekIcon}>
        <Megaphone size={26} color={colors.gold} strokeWidth={2.2} />
      </View>
      <Text serif color={colors.ink} style={{ fontSize: 23, lineHeight: 28, textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="callout" color={dark.textSecondary} style={{ textAlign: 'center', maxWidth: 320 }}>
        Dites ce que vous cherchez : les vendeurs du marché vous répondent, souvent dans la journée.
      </Text>
      <Button label="Publier « Je cherche »" variant="cta" icon={PackageSearch} onPress={onSeek} />
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
          <Text variant="callout" weight="600" color={dark.textSecondary} style={{ textDecorationLine: 'underline' }}>
            Voir tout le marché
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { backgroundColor: dark.background, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xl, overflow: 'hidden' },
  introTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, height: 44, paddingLeft: 6, paddingRight: spacing.md, borderRadius: radius.pill, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  cityIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  search: { marginTop: spacing.lg, height: 48, borderRadius: 15, backgroundColor: dark.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  market: { paddingHorizontal: 14, paddingTop: spacing.lg, gap: spacing.md },
  launchRow: { flexDirection: 'row', gap: 10 },
  aisle: { flex: 1, minHeight: 104, borderRadius: radius.card, padding: 14, gap: 10, justifyContent: 'space-between' },
  aisleOn: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.gold },
  aislePaper: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border },
  aisleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: dark.wecciSoft, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 42, paddingHorizontal: 14, borderRadius: 14 },
  seek: { marginHorizontal: 14, alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: dark.borderStrong, backgroundColor: dark.surface },
  seekIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  tiles: { paddingHorizontal: 14, paddingTop: spacing.md, gap: 8 },
  tileRing: { borderRadius: 16 },
  tile: { width: 112, height: 84, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  tileOn: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.gold },
  tilePaper: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border },
  tileIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: dark.wecciSoft, alignItems: 'center', justifyContent: 'center' },
  tileIconOn: { backgroundColor: colors.night },
  pills: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs },
  pill: { height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, justifyContent: 'center' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: dark.borderStrong },
  discovery: { paddingTop: spacing.xl },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  rowSub: { paddingHorizontal: 14, marginTop: 2 },
  rowScroll: { paddingHorizontal: 14, gap: 10, paddingTop: spacing.md },
  seller: { width: 156, padding: 12, borderRadius: 16, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, alignItems: 'center', gap: 10 },
  follow: { alignSelf: 'stretch', height: 40, borderRadius: 12, borderWidth: 1, borderColor: dark.borderStrong, alignItems: 'center', justifyContent: 'center' },
  followDone: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: dark.border },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: dark.borderStrong, backgroundColor: dark.surface },
  choiceOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  pillOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: 14, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  leadRow: { paddingHorizontal: 14, marginBottom: 10, alignItems: 'center' },
  gridRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  gridRowDesktop: { gap: DESKTOP_GAP, paddingHorizontal: DESKTOP_PAD, marginBottom: DESKTOP_GAP },
  desktopList: { width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center' },
  tilesWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DESKTOP_PAD, gap: 10 },
  empty: { marginHorizontal: 14, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: dark.borderStrong, backgroundColor: dark.surface },
});
