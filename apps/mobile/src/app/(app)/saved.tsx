import { useQuery } from '@tanstack/react-query';
import { Bookmark, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { gridItemWidth, ListingCard } from '@/components/ListingCard';
import { PostCard } from '@/components/PostCard';
import { Chip, EmptyState, Header, Screen, spacing } from '@/design';
import { fetchSavedPosts } from '@/lib/api/posts';
import { fetchSavedProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import type { PostCardData, ProductCard } from '@/lib/types';

export default function Saved() {
  const { userId } = useAuth();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'products' | 'posts'>('products');
  const products = useQuery({ queryKey: ['saved-products'], queryFn: () => fetchSavedProducts(userId ?? ''), enabled: tab === 'products' });
  const posts = useQuery({ queryKey: ['saved-posts'], queryFn: () => fetchSavedPosts(userId ?? ''), enabled: tab === 'posts' });
  const rows = useMemo(() => {
    const items = products.data ?? [];
    const out: ProductCard[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [products.data]);
  const itemW = gridItemWidth(width);

  return (
    <Screen>
      <Header title="Enregistrés" />
      <View style={styles.chips}>
        <Chip label="Articles favoris" selected={tab === 'products'} onPress={() => setTab('products')} />
        <Chip label="Publications" selected={tab === 'posts'} onPress={() => setTab('posts')} />
      </View>
      {tab === 'products' ? (
        <FlatList
          key="p"
          data={rows}
          keyExtractor={(r) => r.map((p) => p.id).join('-')}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.map((p) => (
                <ListingCard key={p.id} product={p} width={itemW} />
              ))}
            </View>
          )}
          ListEmptyComponent={products.isPending ? undefined : <EmptyState icon={Heart} title="Aucun favori" body="Touchez le cœur sur un article pour le retrouver ici." />}
        />
      ) : (
        <FlatList<PostCardData>
          key="s"
          data={posts.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} showReason={false} />}
          ListEmptyComponent={posts.isPending ? undefined : <EmptyState icon={Bookmark} title="Aucune publication enregistrée" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
});
