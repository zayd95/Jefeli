/**
 * Pick several articles and drop them into a conversation as product cards.
 *
 * This is deliberately the smallest reusable piece of conversation-first commerce: a buyer can
 * gather a few of the seller's articles in one go (« je prends celle-ci et celle-là ? ») and a
 * seller can suggest several of theirs. There is no cart, stock reservation, total or payment —
 * each card stays an ordinary product message and the members agree on everything in the thread.
 * The `selected` id list is the hand-off point a later order summary could reuse.
 */
import { formatListingPrice, toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Store } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button, colors, EmptyState, radius, Sheet, Skeleton, spacing, Text, useToast } from '@/design';
import { fetchSellerProducts } from '@/lib/api/products';
import type { ProductCard } from '@/lib/types';

import { Thumb } from '../Media';

export const MAX_PRODUCTS_PER_SEND = 5;

type Owner = 'other' | 'me';

export function ProductPicker({
  visible,
  onClose,
  me,
  otherId,
  otherName,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  me: string;
  otherId: string | null;
  otherName: string;
  onSend: (productIds: string[]) => Promise<void>;
}) {
  const toast = useToast();
  const [owner, setOwner] = useState<Owner>('other');
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sellerId = owner === 'me' ? me : otherId;

  const products = useQuery({
    queryKey: ['seller-products', sellerId, 'picker'],
    queryFn: () => fetchSellerProducts(sellerId ?? '', { onlyActive: false }),
    enabled: visible && !!sellerId,
  });
  const list = (products.data ?? []).filter((p) => p.status === 'active' || p.status === 'reserved');

  function close() {
    setSelected([]);
    onClose();
  }

  function toggle(p: ProductCard) {
    setSelected((cur) => {
      if (cur.includes(p.id)) return cur.filter((id) => id !== p.id);
      if (cur.length >= MAX_PRODUCTS_PER_SEND) {
        toast(`${MAX_PRODUCTS_PER_SEND} articles maximum par envoi.`, 'info');
        return cur;
      }
      return [...cur, p.id];
    });
  }

  async function send() {
    if (selected.length === 0 || sending) return;
    setSending(true);
    try {
      await onSend(selected);
      close();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSending(false);
    }
  }

  const firstName = otherName.split(' ')[0] ?? otherName;

  return (
    <Sheet visible={visible} onClose={close} title="Envoyer des articles">
      <View style={styles.segment} accessibilityRole="tablist">
        {(
          [
            { key: 'other', label: `Articles de ${firstName}` },
            { key: 'me', label: 'Mes articles' },
          ] as { key: Owner; label: string }[]
        ).map((t) => {
          const on = owner === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setOwner(t.key);
                setSelected([]);
              }}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              aria-selected={on}
            >
              <Text variant="callout" weight="700" color={on ? colors.onPrimary : colors.ink} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {products.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : list.length === 0 ? (
        <EmptyState compact icon={Store} title="Aucun article disponible" body={owner === 'me' ? 'Publiez un article pour pouvoir le proposer ici.' : `${firstName} n’a pas d’article disponible pour le moment.`} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          style={{ maxHeight: 360 }}
          renderItem={({ item }) => {
            const on = selected.includes(item.id);
            return (
              <Pressable
                onPress={() => toggle(item)}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && !on && { backgroundColor: colors.surfaceSubtle }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                aria-checked={on}
                accessibilityLabel={`${item.title}, ${formatListingPrice(item)}${item.status === 'reserved' ? ', réservé' : ''}`}
              >
                <Thumb media={item.media[0]} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text variant="callout" weight="600" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="secondary" weight="700" numberOfLines={1}>
                    {formatListingPrice(item, { compact: true })}
                    {item.status === 'reserved' ? ' · Réservé' : ''}
                  </Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={colors.onPrimary} strokeWidth={3} /> : null}</View>
              </Pressable>
            );
          }}
        />
      )}

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
        Chaque article est envoyé comme une fiche dans la conversation. Rien n’est réservé ni payé : vous vous mettez d’accord ensemble.
      </Text>
      <Button
        label={selected.length > 0 ? `Envoyer ${selected.length} article${selected.length > 1 ? 's' : ''}` : 'Choisissez des articles'}
        variant="primary"
        disabled={selected.length === 0}
        loading={sending}
        onPress={send}
        style={{ marginTop: spacing.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle, marginBottom: spacing.md },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  segmentOn: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, minHeight: 64 },
  rowOn: { backgroundColor: colors.mintSoft },
  thumb: { width: 48, height: 48, borderRadius: radius.sm },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
