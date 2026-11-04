/**
 * Explorer, ported from the approved Lovable lab: a dark editorial intro (Atlantic night with the
 * woven motif, serif title, glass city pill, near-white search pill) over a clean near-white
 * #FAFBFA body with pure white cards.
 *   1. Where: the city pill (all cities, my city, or an active city) — sheet of real cities
 *   2. Category: 84-pt tiles in one horizontal row, « Tous » first
 *   3. What: Tout · Neuf · Occasion · Wecci (troc) pills
 * Every filter maps to the existing browse_products RPC (mode / condition / category / city).
 * Home's discovery chips open Explorer with `?kind=trade|used`.
 */
import { toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, Globe2, MapPin, Navigation, PackageSearch, Search, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { colors, dark, EmptyState, ErrorState, Motif, radius, Screen, Sheet, SheetAction, Skeleton, spacing, Text } from '@/design';
import { browseProducts, fetchActiveCities, fetchCategories, PRODUCT_PAGE, type BrowseMode } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { ALL_CATEGORIES_TILE, categoryTile } from '@/lib/categoryIcons';
import { useDockSpace } from '@/lib/dock';
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

export default function Explore() {
  // The safe-area strip and the intro are Atlantic night, so light status-bar icons.
  useDarkStatusBar();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const dockSpace = useDockSpace();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(isKind(params.kind) ? params.kind : 'all');
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [citySheet, setCitySheet] = useState(false);

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
  const products = useInfiniteQuery({
    queryKey: ['explore', kind, category, city],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => browseProducts({ mode, condition, category, city, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PRODUCT_PAGE ? undefined : all.length * PRODUCT_PAGE),
  });

  const items = useMemo(() => products.data?.pages.flat() ?? [], [products.data]);
  // Lovable rhythm: one large lead card, then two columns.
  const rows = useMemo<Row[]>(() => {
    if (items.length === 0) return [];
    const out: Row[] = [{ type: 'lead', product: items[0] as ProductCard }];
    for (let i = 1; i < items.length; i += 2) out.push({ type: 'pair', items: items.slice(i, i + 2) });
    return out;
  }, [items]);
  const itemW = gridItemWidth(width);
  const leadW = Math.min(width, 720) - spacing.lg * 2;

  const cats = categories.data ?? [];
  const selectedCat = cats.find((c) => c.slug === category);
  const filtered = kind !== 'all' || !!category || !!city;
  const clear = () => {
    setKind('all');
    setCategory(null);
    setCity(null);
  };
  const heading =
    kind === 'trade' ? 'Wecci · Échange' : selectedCat ? selectedCat.name : kind === 'used' ? 'Occasions' : kind === 'new' ? 'Articles neufs' : city ? `À ${city}` : 'Nouveautés';

  const header = (
    <View>
      <View style={styles.intro}>
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
        <Text variant="body" color={dark.textStrong} style={styles.introText}>
          Ce que font les gens d’ici : ateliers, boutiques, occasions et troc entre voisins.
        </Text>
        <Pressable onPress={() => router.push('/search')} style={styles.search} accessibilityRole="button" accessibilityLabel="Rechercher">
          <Search size={20} color={colors.textSecondary} />
          <Text variant="body" tone="secondary" numberOfLines={1}>
            Un article, une boutique, un quartier…
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} accessibilityLabel="Catégories">
        <CategoryTile all icon={ALL_CATEGORIES_TILE.icon} label={ALL_CATEGORIES_TILE.short} a11y="Toutes les catégories" selected={!category} onPress={() => setCategory(null)} />
        {cats.map((c) => {
          const t = categoryTile(c.slug, c.name);
          return <CategoryTile key={c.slug} icon={t.icon} label={t.short} a11y={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />;
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} accessibilityRole="tablist">
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              accessibilityLabel={k.label}
            >
              <Text variant="callout" weight="600" color={on ? dark.text : colors.textSecondary} style={{ fontSize: 13 }}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text serif weight="600" style={{ fontSize: 22, lineHeight: 28, color: colors.ink, flexShrink: 1 }} numberOfLines={1}>
          {heading}
        </Text>
        {filtered ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer les filtres" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text variant="callout" weight="600" tone="secondary" style={{ textDecorationLine: 'underline', fontSize: 13 }}>
              Effacer
            </Text>
          </Pressable>
        ) : null}
      </View>
      {kind === 'trade' ? (
        <Text variant="callout" tone="secondary" style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xs, marginBottom: spacing.md }}>
          Wecci, c’est échanger : ces membres acceptent de discuter d’un troc, avec ou sans différence en argent.
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen background={dark.background}>
      <FlatList<Row>
        style={{ backgroundColor: colors.background }}
        data={rows}
        keyExtractor={(row) => (row.type === 'lead' ? `lead-${row.product.id}` : row.items.map((p) => p.id).join('-'))}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.type === 'lead' ? (
            <View style={styles.leadRow}>
              <ListingCard product={item.product} width={leadW} big />
            </View>
          ) : (
            <View style={styles.gridRow}>
              {item.items.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} />
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
            <View style={styles.empty}>
              <EmptyState
                compact
                icon={PackageSearch}
                title="Rien pour ces filtres"
                body={filtered ? 'Essayez une autre ville, une autre catégorie ou un autre type.' : 'Les premiers articles arrivent bientôt.'}
                actionLabel={filtered ? 'Effacer les filtres' : undefined}
                onAction={filtered ? clear : undefined}
              />
            </View>
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.ink} />}
        contentContainerStyle={{ paddingBottom: dockSpace, flexGrow: 1 }}
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
    </Screen>
  );
}

/** Lovable 84-pt category tile: « Tous » on night with the motif, categories on paper. */
function CategoryTile({ icon: Icon, label, a11y, selected, onPress, all }: { icon: LucideIcon; label: string; a11y: string; selected: boolean; onPress: () => void; all?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tileRing, selected && styles.tileRingOn, pressed && { transform: [{ scale: 0.96 }] }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={a11y}
    >
      <View style={[styles.tile, all ? styles.tileAll : styles.tilePaper]}>
        {all ? <Motif /> : null}
        <View style={[styles.tileIcon, all && { backgroundColor: dark.mintSoft }]}>
          <Icon size={17} color={all ? dark.mint : colors.ink} strokeWidth={2} />
        </View>
        <Text weight="700" color={all ? dark.text : colors.ink} numberOfLines={1} style={{ fontSize: 13, lineHeight: 16 }}>
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
  introText: { marginTop: 4, maxWidth: 320, fontSize: 15, lineHeight: 21 },
  search: { marginTop: spacing.lg, height: 48, borderRadius: radius.pill, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  tiles: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 6 },
  tileRing: { padding: 2, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  tileRingOn: { borderColor: colors.ink },
  tile: { width: 80, height: 80, borderRadius: 18, overflow: 'hidden', justifyContent: 'space-between', padding: 10 },
  tileAll: { backgroundColor: dark.background },
  tilePaper: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tileIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  pills: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs },
  pill: { height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  leadRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md, alignItems: 'center' },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  empty: { marginHorizontal: spacing.lg, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
});
