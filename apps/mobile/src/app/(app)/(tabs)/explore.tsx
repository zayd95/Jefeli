import { toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MapPin, PackageSearch } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { Chip, colors, EmptyState, ErrorState, radius, Screen, SearchBar, Skeleton, spacing, Text } from '@/design';
import { browseProducts, fetchActiveCities, fetchCategories, PRODUCT_PAGE, type BrowseMode } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import type { ProductCard } from '@/lib/types';

const MODES: { key: BrowseMode; label: string }[] = [
  { key: 'recent', label: 'Nouveautés' },
  { key: 'nearby', label: 'À proximité' },
  { key: 'occasions', label: 'Occasions' },
  { key: 'troc', label: 'Troc' },
];

export default function Explore() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<BrowseMode>('recent');
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const cities = useQuery({ queryKey: ['active-cities'], queryFn: fetchActiveCities, staleTime: 5 * 60_000 });

  const effectiveCity = mode === 'nearby' ? (city ?? profile?.city ?? null) : city;
  const products = useInfiniteQuery({
    queryKey: ['explore', mode, category, effectiveCity],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => browseProducts({ mode, category, city: effectiveCity, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PRODUCT_PAGE ? undefined : all.length * PRODUCT_PAGE),
  });

  const items = useMemo(() => products.data?.pages.flat() ?? [], [products.data]);
  const rows = useMemo(() => {
    const out: ProductCard[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [items]);
  const itemW = gridItemWidth(width);

  const header = (
    <View>
      <View style={styles.top}>
        <Text variant="title">Explorer</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <SearchBar onPress={() => router.push('/search')} placeholder="Produits, vendeurs, quartiers…" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {MODES.map((m) => (
          <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => setMode(m.key)} />
        ))}
      </ScrollView>

      <Text variant="headline" weight="800" style={styles.section}>
        Catégories
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(categories.data ?? []).map((c) => (
          <Pressable
            key={c.slug}
            onPress={() => setCategory(category === c.slug ? null : c.slug)}
            style={[styles.cat, category === c.slug && styles.catOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: category === c.slug }}
          >
            <Text variant="callout" weight="600" color={category === c.slug ? colors.white : colors.ink}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {(cities.data ?? []).length > 0 ? (
        <>
          <Text variant="headline" weight="800" style={styles.section}>
            Par ville
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(cities.data ?? []).map((c) => (
              <Chip
                key={c.city}
                icon={MapPin}
                label={`${c.city} · ${c.listings}`}
                selected={city === c.city}
                onPress={() => setCity(city === c.city ? null : c.city)}
                style={city === c.city ? undefined : styles.idle}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.resultHeader}>
        <Text variant="headline" weight="800">
          {mode === 'nearby' ? `Près de ${effectiveCity ?? 'chez vous'}` : MODES.find((m) => m.key === mode)?.label}
        </Text>
        {category || city ? (
          <Pressable
            onPress={() => {
              setCategory(null);
              setCity(null);
            }}
            hitSlop={10}
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
          ) : mode === 'nearby' && !effectiveCity ? (
            <EmptyState icon={MapPin} title="Choisissez une ville" body="Ajoutez votre ville dans votre profil ou sélectionnez-en une ci-dessus." />
          ) : (
            <EmptyState icon={PackageSearch} title="Aucun article trouvé" body="Essayez une autre catégorie ou une autre ville." />
          )
        }
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.ink} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: 6, paddingBottom: spacing.sm },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  cat: { paddingHorizontal: 14, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  catOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
});
