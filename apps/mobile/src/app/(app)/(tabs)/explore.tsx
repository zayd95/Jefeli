/**
 * Explorer: one compact filter hierarchy instead of several horizontal carousels.
 *   1. What: Tout · Neuf · Occasion · Troc (segmented, one row)
 *   2. Category: « Tous » by default, the main categories, « Voir tout » expands the rest
 *   3. Where: one city button (all cities, my city, or an active city) in a sheet
 * Every filter maps to the existing browse_products RPC (mode / condition / category / city).
 */
import { toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronDown, Globe2, MapPin, Navigation, PackageSearch } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { colors, EmptyState, ErrorState, radius, Screen, SearchBar, Sheet, SheetAction, Skeleton, spacing, Text } from '@/design';
import { browseProducts, fetchActiveCities, fetchCategories, PRODUCT_PAGE, type BrowseMode } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import type { ProductCard } from '@/lib/types';

type Kind = 'all' | 'new' | 'used' | 'trade';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'new', label: 'Neuf' },
  { key: 'used', label: 'Occasion' },
  { key: 'trade', label: 'Troc' },
];
const FEATURED = 5;

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
  const shownCats = allCategories ? cats : cats.slice(0, FEATURED).concat(selectedCat && cats.indexOf(selectedCat) >= FEATURED ? [selectedCat] : []);
  const filtered = kind !== 'all' || !!category || !!city;

  const header = (
    <View>
      <View style={styles.top}>
        <Text variant="title">Explorer</Text>
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
              <Text variant="callout" weight="700" color={on ? colors.white : colors.ink}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.cats}>
        <CategoryChip label="Tous" selected={!category} onPress={() => setCategory(null)} />
        {shownCats.map((c) => (
          <CategoryChip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />
        ))}
        {cats.length > FEATURED ? (
          <CategoryChip label={allCategories ? 'Moins' : 'Voir tout'} subtle onPress={() => setAllCategories((x) => !x)} />
        ) : null}
      </View>

      <View style={styles.resultHeader}>
        <Pressable onPress={() => setCitySheet(true)} style={styles.cityButton} accessibilityRole="button" accessibilityLabel={`Ville : ${city ?? 'toutes les villes'}. Changer`}>
          <MapPin size={16} color={colors.ink} />
          <Text variant="callout" weight="700">
            {city ?? 'Toutes les villes'}
          </Text>
          <ChevronDown size={16} color={colors.textSecondary} />
        </Pressable>
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
            <Text variant="callout" weight="600" tone="secondary">
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

function CategoryChip({ label, selected, subtle, onPress }: { label: string; selected?: boolean; subtle?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cat, selected && styles.catOn, subtle && styles.catSubtle, pressed && !selected && { backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      aria-selected={!!selected}
      accessibilityLabel={label}
    >
      <Text variant="caption" weight="700" color={selected ? colors.white : colors.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  segment: { flexDirection: 'row', marginHorizontal: spacing.lg, padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.ink },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  cat: { paddingHorizontal: 11, minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  catOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  catSubtle: { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceSubtle },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  cityButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
});
