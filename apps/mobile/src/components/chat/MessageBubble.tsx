import { formatClock, formatListingPrice } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, Text } from '@/design';
import { fetchProduct } from '@/lib/api/products';
import { useMediaUrl } from '@/lib/media';
import type { MessageRow } from '@/lib/types';

import { Thumb } from '../Media';
import { VoiceMessage } from './VoiceMessage';

export const SYSTEM_COPY: Record<string, string> = {
  offer_accepted: 'Proposition acceptée. Un accord a été enregistré : convenez du lieu et du paiement entre vous.',
  offer_rejected: 'Proposition refusée.',
  offer_withdrawn: 'Proposition retirée.',
  agreement_completed: 'Échange déclaré terminé par les deux membres.',
  agreement_canceled: 'Accord annulé.',
  agreement_disputed: 'Un litige a été signalé à l’équipe de modération.',
};

function ProductMessage({ productId }: { productId: string }) {
  const q = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId), staleTime: 60_000 });
  const p = q.data;
  if (!p) {
    return (
      <Text variant="callout" tone="secondary">
        {q.isPending ? 'Chargement de l’article…' : 'Article indisponible'}
      </Text>
    );
  }
  return (
    <Pressable onPress={() => router.push(`/p/${p.id}`)} style={styles.product} accessibilityRole="button" accessibilityLabel={`Article ${p.title}`}>
      <Thumb media={p.media[0]} style={styles.productThumb} />
      <View style={{ flex: 1 }}>
        <Text variant="micro" weight="800" tone="secondary" style={{ letterSpacing: 0.6 }}>
          ARTICLE
        </Text>
        <Text variant="callout" weight="700" numberOfLines={2}>
          {p.title}
        </Text>
        <Text variant="callout" weight="800">
          {formatListingPrice(p)}
        </Text>
        {p.status !== 'active' ? (
          <Text variant="caption" tone="secondary" weight="600">
            {p.status === 'sold' ? 'Vendu' : p.status === 'reserved' ? 'Réservé' : 'Indisponible'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ImageMessage({ path, meta }: { path: string; meta: { width?: number; height?: number } }) {
  const uri = useMediaUrl('private-media', path);
  const w = 220;
  const h = meta.width && meta.height ? Math.min(300, Math.max(140, Math.round((w * meta.height) / meta.width))) : 220;
  return (
    <View style={{ width: w, height: h, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Photo envoyée" /> : null}
    </View>
  );
}

export function MessageBubble({
  message,
  mine,
  showTime,
  receipt,
  onLongPress,
}: {
  message: MessageRow;
  mine: boolean;
  showTime: boolean;
  receipt?: 'Envoyé' | 'Vu' | null;
  onLongPress?: () => void;
}) {
  const meta = (message.attachment_meta ?? {}) as { width?: number; height?: number; duration_ms?: number };

  if (message.kind === 'system') {
    return (
      <View style={styles.system}>
        <Text variant="caption" tone="secondary" align="center">
          {SYSTEM_COPY[message.body] ?? message.body}
        </Text>
      </View>
    );
  }

  const deleted = !!message.deleted_at;
  let content: React.ReactNode;
  if (deleted) {
    content = (
      <Text variant="callout" tone="tertiary" style={{ fontStyle: 'italic' }}>
        Message supprimé
      </Text>
    );
  } else if (message.kind === 'image' && message.attachment_path) {
    content = <ImageMessage path={message.attachment_path} meta={meta} />;
  } else if (message.kind === 'voice' && message.attachment_path) {
    content = <VoiceMessage path={message.attachment_path} durationMs={meta.duration_ms} mine={mine} />;
  } else if (message.kind === 'product' && message.product_id) {
    content = <ProductMessage productId={message.product_id} />;
  } else if (message.kind === 'story_reply') {
    content = (
      <View style={{ gap: 4 }}>
        <Text variant="micro" weight="800" tone="secondary" style={{ letterSpacing: 0.6 }}>
          {mine ? 'VOUS AVEZ RÉPONDU À SON STATUT' : 'A RÉPONDU À VOTRE STATUT'}
        </Text>
        <Text variant="body">{message.body}</Text>
      </View>
    );
  } else {
    content = <Text variant="body">{message.body}</Text>;
  }

  const media = !deleted && (message.kind === 'image' || message.kind === 'product');
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={deleted ? undefined : onLongPress}
        delayLongPress={350}
        style={[styles.bubble, mine ? styles.mine : styles.theirs, media && styles.mediaBubble]}
        accessibilityHint={onLongPress ? 'Appui long pour plus d’options' : undefined}
      >
        {content}
      </Pressable>
      {showTime || receipt ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 3, fontSize: 11 }}>
          {formatClock(message.created_at)}
          {receipt ? ` · ${receipt}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, marginVertical: 3, maxWidth: '100%' },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  mine: { backgroundColor: colors.mintSoft, borderTopRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  mediaBubble: { padding: 6 },
  system: { alignSelf: 'center', maxWidth: '86%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginVertical: spacing.sm, backgroundColor: colors.surfaceSubtle, borderRadius: radius.md },
  product: { flexDirection: 'row', gap: spacing.md, padding: 6, width: 260 },
  productThumb: { width: 72, height: 72, borderRadius: radius.sm },
});
