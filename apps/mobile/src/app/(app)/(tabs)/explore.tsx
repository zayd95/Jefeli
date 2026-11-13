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
import { Check, ChevronDown, Flame, Globe2, MapPin, Navigation, PackageSearch, Search, SlidersHorizontal, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { Avatar, Button, colors, dark, DemoBadge, EmptyState, ErrorState, Eyebrow, light, Motif, radius, Screen, Sheet, SheetAction, Skeleton, spacing, Text, useToast, VerifiedBadge } from '@/design';
import {
  exploreProducts,
  fetchActiveCities,
  fetchCategories,
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
import { ALL_CATEGORIES_TILE, categoryTile } from '@/lib/categoryIcons';
import { useDockSpace } from '@/lib/dock';
import { useLayout } from '@/lib/layout';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { ProductCard } from '@/lib/types';

type Kind = 'all' | 'new' | 'used' | 'trade';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'new', label: 'Neuf' },
  { key: 'used', label: 'Occasion' },
  { key: 'trade', label: 'Wecci · Troc' },
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
  const { desktop } = useLayout();
  const [contentWidth, setContentWidth] = useState(width);
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(isKind(params.kind) ? params.kind : 'all');
  const [category, setCategory] = useState<string | null>(null);
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
  const products = useInfiniteQuery({
    queryKey: ['explore', kind, category, city, price, offer, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      exploreProducts({ mode, condition, category, city, minPrice: range.min, maxPrice: range.max, offer: offerArg, sort, offset: pageParam }),
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

  const cats = categories.data ?? [];
  const selectedCat = cats.find((c) => c.slug === category);
  const extraFilters = (price !== 'any' ? 1 : 0) + (offer !== 'all' ? 1 : 0) + (sort !== 'recent' ? 1 : 0);
  const filtered = kind !== 'all' || !!category || !!city || extraFilters > 0;
  const clear = () => {
    setKind('all');
    setCategory(null);
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
    kind === 'trade' ? 'Wecci · Échange' : selectedCat ? selectedCat.name : kind === 'used' ? 'Occasions' : kind === 'new' ? 'Articles neufs' : city ? `À ${city}` : 'Nouveautés';

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
              <MapPin size={16} color={colors.night} strokeWidth={2.2} />
            </View>
            <Text variant="callout" weight="600" tone="fog" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>
              {city ?? 'Tout le Sénégal'}
            </Text>
            <ChevronDown size={16} color={dark.textSecondary} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/search')} style={styles.search} accessibilityRole="button" accessibilityLabel="Rechercher">
          <Search size={20} color={light.textSecondary} />
          <Text variant="body" color={light.textSecondary} numberOfLines={1}>
            Un article, une boutique, un quartier…
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal={!desktop} scrollEnabled={!desktop} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tiles, desktop && styles.tilesWrap]} accessibilityLabel="Catégories">
        <CategoryTile all icon={ALL_CATEGORIES_TILE.icon} label={ALL_CATEGORIES_TILE.short} a11y="Toutes les catégories" selected={!category} onPress={() => setCategory(null)} />
        {cats.map((c) => {
          const t = categoryTile(c.slug, c.name);
          return <CategoryTile key={c.slug} icon={t.icon} label={t.short} a11y={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />;
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pills, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityRole="tablist">
        <Pressable
          onPress={() => setFilterSheet(true)}
          hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [styles.pill, styles.filterPill, extraFilters > 0 && styles.pillOn, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityRole="button"
          accessibilityLabel={extraFilters > 0 ? `Filtres, ${extraFilters} actif${extraFilters > 1 ? 's' : ''}` : 'Filtres : prix, achat ou Wecci, tri'}
        >
          <SlidersHorizontal size={15} color={extraFilters > 0 ? colors.onPrimary : light.ink} strokeWidth={2.2} />
          <Text variant="callout" weight="700" color={extraFilters > 0 ? colors.onPrimary : light.ink} style={{ fontSize: 13 }}>
            {extraFilters > 0 ? `Filtres · ${extraFilters}` : 'Filtres'}
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
              <Text variant="callout" weight="600" color={on ? colors.onPrimary : light.textSecondary} style={{ fontSize: 13 }}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {trendItems.length > 0 ? (
        <View style={styles.discovery}>
          <View style={[styles.rowHead, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            <Flame size={18} color="#C2410C" strokeWidth={2.2} />
            <Text serif style={{ fontSize: 22, lineHeight: 27, color: light.ink }} accessibilityRole="header">
              Tendances cette semaine
            </Text>
          </View>
          <Text variant="caption" style={[styles.rowSub, { color: light.textSecondary }, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            Les articles que les membres ajoutent le plus à leurs favoris.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rowScroll, desktop && { paddingHorizontal: DESKTOP_PAD }]} accessibilityLabel="Tendances cette semaine">
            {trendItems.map((p) => (
              <ListingCard key={p.id} product={p} width={desktop ? 220 : 168} surface="paper" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {sellerItems.length > 0 ? (
        <View style={styles.discovery}>
          <View style={[styles.rowHead, desktop && { paddingHorizontal: DESKTOP_PAD }]}>
            <UserPlus size={18} color={light.accent} strokeWidth={2.2} />
            <Text serif style={{ fontSize: 22, lineHeight: 27, color: light.ink }} accessibilityRole="header">
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
          <Text serif style={{ fontSize: desktop ? 34 : 29, lineHeight: desktop ? 38 : 33, color: light.ink, flexShrink: 1 }} numberOfLines={1}>
            {heading}
          </Text>
        </View>
        {filtered ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer les filtres" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text variant="callout" weight="600" color={light.textSecondary} style={{ textDecorationLine: 'underline', fontSize: 13 }}>
              Effacer
            </Text>
          </Pressable>
        ) : null}
      </View>
      {kind === 'trade' ? (
        <Text variant="callout" color={light.textSecondary} style={{ paddingHorizontal: 14, marginTop: -spacing.xs, marginBottom: spacing.md }}>
          Wecci : échange possible, avec ou sans complément en argent.
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen background={dark.background}>
      <FlatList<Row>
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        style={{ backgroundColor: light.background }}
        data={rows}
        keyExtractor={(row) => (row.type === 'lead' ? `lead-${row.product.id}` : row.items.map((p) => p.id).join('-'))}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.type === 'lead' ? (
            <View style={styles.leadRow}>
              <ListingCard product={item.product} width={leadW} big surface="paper" />
            </View>
          ) : (
            <View style={[styles.gridRow, desktop && styles.gridRowDesktop]}>
              {item.items.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} showVerified={desktop} surface="paper" />
              ))}
            </View>
          )
        }
        ListEmptyComponent={
          products.isPending ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }} accessibilityLabel="Chargement">
              <Skeleton height={Math.round((leadW * 11) / 16)} radius={20} tone="paper" />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={190} radius={18} tone="paper" />
                    <Skeleton height={14} width="60%" tone="paper" />
                  </View>
                ))}
              </View>
            </View>
          ) : products.isError ? (
            <ErrorState message={toFrenchError(products.error)} onRetry={() => products.refetch()} />
          ) : (
            <View style={styles.empty}>
              <EmptyState
                tone="paper"
                compact
                icon={PackageSearch}
                title="Rien pour ces filtres"
                body={filtered ? 'Essayez un autre prix, une autre ville ou une autre catégorie.' : 'Les premiers articles arrivent bientôt.'}
                actionLabel={filtered ? 'Effacer les filtres' : undefined}
                onAction={filtered ? clear : undefined}
              />
            </View>
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={light.ink} />}
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
              {on ? <Check size={15} color={colors.onPrimary} strokeWidth={2.6} /> : null}
              <Text variant="callout" weight="700" color={on ? colors.onPrimary : dark.text} style={{ fontSize: 14 }}>
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
          <Text weight="700" color={light.ink} numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
            {seller.display_name}
          </Text>
          {seller.verification_level === 'merchant_verified' ? <VerifiedBadge size={13} /> : null}
        </View>
        <Text variant="caption" color={light.textSecondary} numberOfLines={1} style={{ maxWidth: 132 }}>
          {[seller.city, `${seller.active_products} article${seller.active_products > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
        </Text>
        {seller.is_demo ? <DemoBadge tone="paper" /> : null}
      </Pressable>
      <Pressable
        onPress={() => void onFollow()}
        disabled={done || busy}
        style={({ pressed }) => [styles.follow, done && styles.followDone, pressed && { transform: [{ scale: 0.97 }] }]}
        accessibilityRole="button"
        accessibilityLabel={done ? `Vous suivez ${seller.display_name}` : `Suivre ${seller.display_name}`}
      >
        <Text variant="callout" weight="700" color={done ? light.ink : colors.onPrimary} style={{ fontSize: 13 }}>
          {done ? 'Suivi' : 'Suivre'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Lovable 84-pt category tile: « Tous » on night with the motif, categories on paper. */
function CategoryTile({ icon: Icon, label, a11y, selected, onPress, all }: { icon: LucideIcon; label: string; a11y: string; selected: boolean; onPress: () => void; all?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tileRing, pressed && { transform: [{ scale: 0.96 }] }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={a11y}
    >
      {/* Active category: Senegalese gold with dark-green content; others: dark green with mint icons. */}
      <View style={[styles.tile, selected ? styles.tileOn : styles.tilePaper]}>
        <View style={[styles.tileIcon, selected && styles.tileIconOn]}>
          <Icon size={17} color={selected ? colors.mintAccent : light.accent} strokeWidth={2} />
        </View>
        <Text weight="600" color={selected ? colors.onPrimary : light.ink} numberOfLines={1} style={{ fontSize: 13, lineHeight: 16 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { backgroundColor: dark.background, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xl, overflow: 'hidden' },
  introTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, height: 44, paddingLeft: 6, paddingRight: spacing.md, borderRadius: radius.pill, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  cityIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  search: { marginTop: spacing.lg, height: 48, borderRadius: 15, backgroundColor: light.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  tiles: { paddingHorizontal: 14, paddingTop: spacing.lg, gap: 10 },
  tileRing: { borderRadius: 16 },
  tile: { width: 112, height: 84, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  tileOn: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  tilePaper: { backgroundColor: light.surface, borderWidth: 1, borderColor: light.border },
  tileIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: light.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tileIconOn: { backgroundColor: colors.night },
  pills: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs },
  pill: { height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: light.border, backgroundColor: light.surface, justifyContent: 'center' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: light.borderStrong },
  discovery: { paddingTop: spacing.xl },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  rowSub: { paddingHorizontal: 14, marginTop: 2 },
  rowScroll: { paddingHorizontal: 14, gap: 10, paddingTop: spacing.md },
  seller: { width: 156, padding: 12, borderRadius: 16, backgroundColor: light.surface, borderWidth: 1, borderColor: light.border, alignItems: 'center', gap: 10 },
  follow: { alignSelf: 'stretch', height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  followDone: { backgroundColor: light.surfaceSubtle, borderWidth: 1, borderColor: light.border },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: dark.borderStrong, backgroundColor: dark.surface },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md, paddingHorizontal: 14, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  leadRow: { paddingHorizontal: 14, marginBottom: 10, alignItems: 'center' },
  gridRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  gridRowDesktop: { gap: DESKTOP_GAP, paddingHorizontal: DESKTOP_PAD, marginBottom: DESKTOP_GAP },
  desktopList: { width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center' },
  tilesWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DESKTOP_PAD, gap: 10 },
  empty: { marginHorizontal: 14, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: light.borderStrong, backgroundColor: light.surface },
});
