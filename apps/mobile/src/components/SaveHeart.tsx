/**
 * Favourite toggle on product cards: the member's real saved articles (product_saves), one shared
 * query for every card, optimistic, rolled back with a French error. Hidden on one's own articles
 * and for visitors who are not signed in.
 */
import { toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colors, useToast } from '@/design';
import { fetchSavedProductIds, setProductSaved } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';

export function SaveHeart({ productId, sellerId, title }: { productId: string; sellerId?: string | null; title: string }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ids = useQuery({ queryKey: ['saved-product-ids', userId], queryFn: () => fetchSavedProductIds(userId as string), enabled: !!userId, staleTime: 60_000 });
  if (!userId || sellerId === userId) return null;
  const saved = (ids.data ?? []).includes(productId);

  async function toggle() {
    const next = !saved;
    const key = ['saved-product-ids', userId];
    qc.setQueryData<string[]>(key, (old = []) => (next ? [...old, productId] : old.filter((id) => id !== productId)));
    qc.setQueryData(['product-saved', productId], next);
    try {
      await setProductSaved(userId as string, productId, next);
      qc.invalidateQueries({ queryKey: ['saved-products'] });
    } catch (e) {
      qc.setQueryData<string[]>(key, (old = []) => (next ? old.filter((id) => id !== productId) : [...old, productId]));
      qc.setQueryData(['product-saved', productId], !next);
      toast(toFrenchError(e), 'error');
    }
  }

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        void toggle();
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.heart, pressed && { transform: [{ scale: 0.92 }] }]}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? `Retirer ${title} des favoris` : `Ajouter ${title} aux favoris`}
    >
      <Heart size={17} color={saved ? colors.red : colors.onPrimary} fill={saved ? colors.red : 'transparent'} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heart: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(246, 245, 237, 0.94)', alignItems: 'center', justifyContent: 'center' },
});
