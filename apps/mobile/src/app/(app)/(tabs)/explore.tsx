/**
 * Explorer: one compact filter hierarchy instead of several horizontal carousels.
 *   1. Where: a location pill next to the title (all cities, my city, or an active city)
 *   2. What: Tout · Neuf · Occasion · Troc (segmented, one row)
 *   3. Category: icon tiles, « Tous » by default; « Voir tout » expands the 4-column grid
 * Every filter maps to the existing browse_products RPC (mode / condition / category / city).
 */
import { toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronDown, Globe2, MapPin, Navigation, PackageSearch, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { colors, EmptyState, ErrorState, radius, Screen, SearchBar, Sheet, SheetAction, Skeleton, spacing, Text } from '@/design';
import { browseProducts, fetchActiveCities, fetchCategories, PRODUCT_PAGE, type BrowseMode } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { ALL_CATEGORIES_TILE, categoryTile } from '@/lib/categoryIcons';
import type { ProductCard } from '@/lib/types';

type Kind = 'all' | 'new' | 'used' | 'trade';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'new', label: 'Neuf' },
  { key: 'used', label: 'Occasion' },
  { key: 'trade', label: 'Troc' },
];
const FEATURED = 3; // + « Tous » = one row of 4 tiles when collapsed
const TILE_COLUMNS = 4;

function browseArgs(kind: Kind): { mode: BrowseMode; condition: string | null } {
  if (kind === 'new') return { mode: 'recent', condition: 'new' };
  if (kind === 'used') return { mode: 'occasions', condition: null };
  if (kind === 'trade') return { mode: 'troc', condition: null };
  return { mode: 'recent', condition: null };
}

export default function Explore() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Kind>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(false);
  const [citySheet, setCitySheet] = useState(false);

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
  const rows = useMemo(() => {
    const out: ProductCard[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [items]);
  const itemW = gridItemWidth(width);

  const cats = categories.data ?? [];
  const selectedCat = cats.find((c) => c.slug === category);
  // Collapsed: « Tous » + 3 tiles (the selected category replaces the third if it is further down).
  const collapsed = selectedCat && cats.indexOf(selectedCat) >= FEATURED ? [...cats.slice(0, FEATURED - 1), selectedCat] : cats.slice(0, FEATURED);
  const shownCats = allCategories ? cats : collapsed;
  const tileW = Math.floor((Math.min(width, 720) - spacing.lg * 2 - spacing.sm * (TILE_COLUMNS - 1)) / TILE_COLUMNS);
  const filtered = kind !== 'all' || !!category || !!city;

  const header = (
    <View>
      <View style={styles.top}>
        <Text variant="title" weight="700" accessibilityRole="header">
          Explorer
        </Text>
        <Pressable
          onPress={() => setCitySheet(true)}
          style={({ pressed }) => [styles.location, pressed && { backgroundColor: colors.surfaceSubtle }]}
          accessibilityRole="button"
          accessibilityLabel={`Ville : ${city ?? 'toutes les villes'}. Changer`}
        >
          <View style={styles.locationIcon}>
            <MapPin size={14} color={colors.ink} strokeWidth={2.4} />
          </View>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {city ?? 'Toutes les villes'}
          </Text>
          <ChevronDown size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SearchBar onPress={() => router.push('/search')} placeholder="Produits, vendeurs, quartiers…" />
      </View>

      <View style={styles.segment} accessibilityRole="tablist">
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              accessibilityLabel={k.label}
            >
              <Text variant="callout" weight={on ? '700' : '500'} color={on ? colors.white : colors.textSecondary}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text variant="headline" weight="600">
          Catégories
        </Text>
        {cats.length > FEATURED ? (
          <Pressable onPress={() => setAllCategories((x) => !x)} hitSlop={10} accessibilityRole="button" accessibilityLabel={allCategories ? 'Réduire les catégories' : `Voir toutes les catégories (${cats.length})`}>
            <Text variant="callout" weight="500" tone="secondary">
              {allCategories ? 'Réduire' : 'Voir tout'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.tiles}>
        <CategoryTile width={tileW} icon={ALL_CATEGORIES_TILE.icon} label={ALL_CATEGORIES_TILE.short} a11y="Toutes les catégories" selected={!category} onPress={() => setCategory(null)} />
        {shownCats.map((c) => {
          const t = categoryTile(c.slug, c.name);
          return <CategoryTile key={c.slug} width={tileW} icon={t.icon} label={t.short} a11y={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />;
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text variant="headline" weight="600">
          {filtered ? 'Résultats' : 'Nouveautés'}
        </Text>
        {filtered ? (
          <Pressable
            onPress={() => {
              setKind('all');
              setCategory(null);
              setCity(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text variant="callout" weight="500" tone="secondary">
              Effacer les filtres
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.map((p) => p.id).join('-')}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.gridRow}>
            {item.map((p) => (
              <ListingCard key={p.id} product={p} width={itemW} />
            ))}
          </View>
        )}
        ListEmptyComponent={
          products.isPending ? (
            <View style={styles.gridRow}>
              {[0, 1].map((i) => (
                <View key={i} style={{ flex: 1, gap: 8 }}>
                  <Skeleton height={190} radius={12} />
                  <Skeleton height={14} width="60%" />
                </View>
              ))}
            </View>
          ) : products.isError ? (
            <ErrorState message={toFrenchError(products.error)} onRetry={() => products.refetch()} />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Aucun article trouvé"
              body={filtered ? 'Essayez une autre catégorie, un autre type ou une autre ville.' : 'Les premiers articles arrivent bientôt.'}
              actionLabel={filtered ? 'Effacer les filtres' : undefined}
              onAction={
                filtered
                  ? () => {
                      setKind('all');
                      setCategory(null);
                      setCity(null);
                    }
                  : undefined
              }
            />
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.ink} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />

      <Sheet visible={citySheet} onClose={() => setCitySheet(false)}>
        <SheetAction
          icon={city === null ? Check : Globe2}
          label="Toutes les villes"
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

function CategoryTile({ width, icon: Icon, label, a11y, selected, onPress }: { width: number; icon: LucideIcon; label: string; a11y: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width }, selected && styles.tileOn, pressed && !selected && { backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={a11y}
    >
      <Icon size={22} color={colors.ink} strokeWidth={selected ? 2.3 : 1.9} />
      <Text variant="caption" weight={selected ? '700' : '500'} numberOfLines={1} align="center" style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minHeight: 40, paddingLeft: 4, paddingRight: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  locationIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', marginHorizontal: spacing.lg, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.ink },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tile: { height: 74, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  tileOn: { backgroundColor: colors.mintSoft, borderColor: colors.action },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
});
