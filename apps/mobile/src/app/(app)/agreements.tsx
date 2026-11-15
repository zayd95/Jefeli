import { AGREEMENT_STATUS_LABELS, formatXOF, timeAgo } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Handshake } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/Media';
import { colors, EmptyState, Header, radius, Screen, spacing, Tag, Text } from '@/design';
import { fetchMyAgreements } from '@/lib/api/offers';
import { useAuth } from '@/lib/auth';
import type { ProductSnapshot } from '@/lib/types';

export default function Agreements() {
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['my-agreements', userId], queryFn: () => fetchMyAgreements(userId ?? '') });
  return (
    <Screen>
      <Header title="Mes accords" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => {
          const t = item.terms as { product: ProductSnapshot; seller: { display_name: string }; buyer: { display_name: string } };
          const other = item.buyer_id === userId ? t.seller.display_name : t.buyer.display_name;
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/agreement/${item.id}`)} accessibilityRole="button">
              <Thumb media={t.product?.image_path ? { storage_path: t.product.image_path, kind: 'image', poster_path: null } : null} style={styles.thumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {t.product?.title ?? 'Article'}
                </Text>
                <Text variant="caption" tone="secondary">
                  {item.kind === 'barter' ? 'Troc' : formatXOF(item.amount_xof)} · avec {other} · {timeAgo(item.created_at)}
                </Text>
              </View>
              <Tag label={AGREEMENT_STATUS_LABELS[item.status] ?? item.status} tone={item.status === 'completed' ? 'mint' : 'neutral'} />
            </Pressable>
          );
        }}
        ListEmptyComponent={q.isPending ? undefined : <EmptyState icon={Handshake} title="Aucun accord" body="Quand une offre ou un troc est accepté, le récapitulatif apparaît ici." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
});
