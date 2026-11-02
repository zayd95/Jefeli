import { toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, PackageSearch, Search as SearchIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { ProfileName } from '@/components/ProfileName';
import { Avatar, Chip, colors, EmptyState, ErrorState, IconButton, Screen, SearchBar, Skeleton, spacing, Text } from '@/design';
import { browseProducts } from '@/lib/api/products';
import { searchProfiles } from '@/lib/api/profiles';
import type { ProductCard } from '@/lib/types';

type Scope = 'products' | 'people';

export default function Search() {
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('products');

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const products = useQuery({
    queryKey: ['search-products', query],
    queryFn: () => browseProducts({ query, limit: 40 }),
    enabled: scope === 'products' && query.length >= 2,
  });
  const people = useQuery({
    queryKey: ['search-people', query],
    queryFn: () => searchProfiles(query),
    enabled: scope === 'people' && query.length >= 2,
  });

  const rows = useMemo(() => {
    const items = products.data ?? [];
    const out: ProductCard[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [products.data]);
  const itemW = gridItemWidth(width);
  const active = scope === 'products' ? products : people;

  return (
    <Screen keyboard>
      <View style={styles.bar}>
        <IconButton icon={ChevronLeft} label="Retour" size={26} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <SearchBar value={text} onChangeText={setText} autoFocus placeholder="Robe wax, iPhone, Médina…" />
        </View>
      </View>
      <View style={styles.scopes}>
        <Chip label="Articles" selected={scope === 'products'} onPress={() => setScope('products')} />
        <Chip label="Membres et boutiques" selected={scope === 'people'} onPress={() => setScope('people')} />
      </View>

      {query.length < 2 ? (
        <EmptyState icon={SearchIcon} title="Que cherchez-vous ?" body="Un produit, une marque, un vendeur, une ville ou un quartier. Les fautes de frappe sont tolérées." />
      ) : active.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : active.isError ? (
        <ErrorState message={toFrenchError(active.error)} onRetry={() => active.refetch()} />
      ) : scope === 'products' ? (
        <FlatList
          data={rows}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(row) => row.map((p) => p.id).join('-')}
          renderItem={({ item }) => (
            <View style={styles.gridRow}>
              {item.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} />
              ))}
            </View>
          )}
          ListEmptyComponent={<EmptyState icon={PackageSearch} title={`Aucun résultat pour « ${query} »`} body="Essayez un mot plus simple, ou cherchez parmi les membres." />}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        />
      ) : (
        <FlatList
          data={people.data ?? []}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/u/${item.handle}`)} style={styles.person} accessibilityRole="button">
              <Avatar path={item.avatar_path} name={item.display_name} size={46} />
              <View style={{ flex: 1 }}>
                <ProfileName profile={item} />
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  @{item.handle}
                  {item.city ? ` · ${item.city}` : ''}
                  {item.products_count > 0 ? ` · ${item.products_count} article${item.products_count > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon={SearchIcon} title={`Personne ne correspond à « ${query} »`} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg, paddingLeft: spacing.xs, gap: 4, paddingVertical: spacing.sm },
  scopes: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
});
