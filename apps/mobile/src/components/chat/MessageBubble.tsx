import { formatClock, formatListingPrice } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, radius, spacing, Text } from '@/design';
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

function ProductMessage({ productId, mine }: { productId: string; mine: boolean }) {
  const q = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId), staleTime: 60_000 });
  const p = q.data;
  const fg = mine ? colors.night : dark.text;
  const soft = mine ? colors.inkSoft : dark.textSecondary;
  if (!p) {
    return (
      <Text variant="callout" color={soft}>
        {q.isPending ? 'Chargement de l’article…' : 'Article indisponible'}
      </Text>
    );
  }
  return (
    <Pressable onPress={() => router.push(`/p/${p.id}`)} style={styles.product} accessibilityRole="button" accessibilityLabel={`Article ${p.title}`}>
      <Thumb media={p.media[0]} style={styles.productThumb} />
      <View style={{ flex: 1 }}>
        <Text variant="micro" weight="800" color={soft} style={{ letterSpacing: 0.6 }}>
          ARTICLE
        </Text>
        <Text variant="callout" weight="700" color={fg} numberOfLines={2}>
          {p.title}
        </Text>
        <Text variant="callout" weight="800" color={fg}>
          {formatListingPrice(p)}
        </Text>
        {p.status !== 'active' ? (
          <Text variant="caption" color={soft} weight="600">
            {p.status === 'sold' ? 'Vendu' : p.status === 'reserved' ? 'Réservé' : 'Indisponible'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A text or voice message about an article (W1.2): one tap back to it. */
function AboutProduct({ productId, mine }: { productId: string; mine: boolean }) {
  const q = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId), staleTime: 60_000 });
  if (!q.data) return null;
  return (
    <Pressable onPress={() => router.push(`/p/${productId}`)} style={[styles.about, { borderColor: mine ? colors.overlay : dark.border }]} accessibilityRole="link" accessibilityLabel={`À propos de ${q.data.title}`}>
      <Thumb media={q.data.media[0]} style={styles.aboutThumb} />
      <Text variant="caption" weight="600" color={mine ? colors.inkSoft : dark.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
        À propos de {q.data.title}
      </Text>
    </Pressable>
  );
}

function ImageMessage({ path, meta }: { path: string; meta: { width?: number; height?: number } }) {
  const uri = useMediaUrl('private-media', path);
  const w = 220;
  const h = meta.width && meta.height ? Math.min(300, Math.max(140, Math.round((w * meta.height) / meta.width))) : 220;
  return (
    <View style={{ width: w, height: h, borderRadius: 16, overflow: 'hidden', backgroundColor: dark.raised }}>
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
  const meta = (message.attachment_meta ?? {}) as { width?: number; height?: number; duration_ms?: number; waveform?: number[] };

  if (message.kind === 'system') {
    return (
      <View style={styles.system}>
        <Text variant="caption" tone="fogSecondary" align="center">
          {SYSTEM_COPY[message.body] ?? message.body}
        </Text>
      </View>
    );
  }

  const deleted = !!message.deleted_at;
  const fg = mine ? colors.night : dark.text;
  let content: React.ReactNode;
  if (deleted) {
    content = (
      <Text variant="callout" color={mine ? colors.inkSoft : dark.textTertiary} style={{ fontStyle: 'italic' }}>
        Message supprimé
      </Text>
    );
  } else if (message.kind === 'image' && message.attachment_path) {
    content = <ImageMessage path={message.attachment_path} meta={meta} />;
  } else if (message.kind === 'voice' && message.attachment_path) {
    content = <VoiceMessage path={message.attachment_path} durationMs={meta.duration_ms} waveform={meta.waveform} mine={mine} />;
  } else if (message.kind === 'product' && message.product_id) {
    content = <ProductMessage productId={message.product_id} mine={mine} />;
  } else if (message.kind === 'story_reply') {
    content = (
      <View style={{ gap: 4 }}>
        <Text variant="micro" weight="800" color={mine ? colors.inkSoft : dark.gold} style={{ letterSpacing: 0.6 }}>
          {mine ? 'VOUS AVEZ RÉPONDU À SON STATUT' : 'A RÉPONDU À VOTRE STATUT'}
        </Text>
        <Text variant="body" color={fg} style={{ fontSize: 14, lineHeight: 20 }}>
          {message.body}
        </Text>
      </View>
    );
  } else {
    content = (
      <Text variant="body" color={fg} style={{ fontSize: 14, lineHeight: 20 }}>
        {message.body}
      </Text>
    );
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
        {!deleted && message.product_id && (message.kind === 'voice' || message.kind === 'text') ? <AboutProduct productId={message.product_id} mine={mine} /> : null}
      </Pressable>
      {showTime || receipt ? (
        <Text variant="caption" tone="fogTertiary" style={{ marginTop: 3, fontSize: 10.5 }}>
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
  // Lovable thread: 21-pt bubbles, mine in mint with night text, theirs deep with fog text.
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 21 },
  mine: { backgroundColor: colors.mint, borderTopRightRadius: 6 },
  theirs: { backgroundColor: dark.surface, borderTopLeftRadius: 6, borderWidth: 1, borderColor: dark.border },
  mediaBubble: { padding: 6 },
  system: { alignSelf: 'center', maxWidth: '86%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginVertical: spacing.sm, backgroundColor: dark.subtle, borderRadius: radius.md },
  product: { flexDirection: 'row', gap: spacing.md, padding: 6, width: 260 },
  productThumb: { width: 72, height: 72, borderRadius: radius.sm },
  about: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, maxWidth: 240 },
  aboutThumb: { width: 22, height: 22, borderRadius: 5 },
});
