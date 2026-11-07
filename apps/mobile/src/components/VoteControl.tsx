/**
 * Community vote on a publication: « pour » (public count) / « contre » (private relevance
 * feedback). One reversible vote per member. Optimistic, with rollback and a French error.
 *
 * Votes are about the publication only: they are not reviews of a product and never feed a
 * seller rating (reviews stay tied to completed agreements).
 */
import { formatCount, toFrenchError } from '@jefeli/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { dark, radius, Text, useToast } from '@/design';
import { votePost } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { cachedPost, patchPost } from '@/lib/postCache';
import type { PostCardData, VoteValue } from '@/lib/types';

type Snapshot = { my_vote: VoteValue; upvote_count: number };

export function VoteControl({ post }: { post: PostCardData }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const mine: VoteValue = post.my_vote ?? 0;
  const isOwn = post.author_id === userId;

  const vote = useMutation({
    mutationFn: (value: VoteValue) => votePost(post.id, value),
    onMutate: (value): Snapshot => {
      const current = cachedPost(qc, post.id) ?? post;
      const prev: Snapshot = { my_vote: current.my_vote ?? 0, upvote_count: current.upvote_count };
      const upvotes = prev.upvote_count - (prev.my_vote === 1 ? 1 : 0) + (value === 1 ? 1 : 0);
      patchPost(qc, post.id, () => ({ my_vote: value, upvote_count: Math.max(0, upvotes) }));
      return prev;
    },
    onError: (e, _value, prev) => {
      if (prev) patchPost(qc, post.id, () => prev);
      toast(toFrenchError(e), 'error');
    },
    onSuccess: (res) => patchPost(qc, post.id, () => ({ my_vote: res.my_vote, upvote_count: res.upvote_count })),
  });

  function press(direction: 1 | -1) {
    if (!userId || isOwn || vote.isPending) return;
    vote.mutate(mine === direction ? 0 : direction);
  }

  const up = mine === 1;
  const down = mine === -1;
  const count = post.upvote_count;
  const countLabel = `${count} vote${count > 1 ? 's' : ''} pour`;

  if (isOwn) {
    // Authors see the positive count of their own publication; they cannot vote on it.
    return (
      <View style={[styles.pill, styles.pillOwn]} accessible accessibilityLabel={countLabel}>
        <ArrowBigUp size={22} color={dark.textSecondary} strokeWidth={1.6} />
        <Text variant="callout" weight="700" tone="fogSecondary" style={styles.count}>
          {formatCount(count)}
        </Text>
      </View>
    );
  }

  // Lovable VoteBar on Atlantic night: quiet fog pill, mint « pour », gold « contre » (private).
  return (
    <View style={styles.pill}>
      <Pressable
        onPress={() => press(1)}
        style={({ pressed }) => [styles.up, pressed && { transform: [{ scale: 0.96 }] }]}
        hitSlop={{ top: 4, bottom: 4, left: 4 }}
        accessibilityRole="button"
        accessibilityLabel={up ? `Retirer mon vote pour. ${countLabel}` : `Voter pour. ${countLabel}`}
        accessibilityState={{ selected: up }} aria-selected={up}
      >
        <ArrowBigUp size={22} color={up ? dark.mint : dark.textStrong} fill={up ? dark.mint : 'transparent'} strokeWidth={1.6} />
        <Text variant="callout" weight="700" color={up ? dark.mint : dark.textStrong} style={styles.count}>
          {formatCount(count)}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => press(-1)}
        style={({ pressed }) => [styles.down, pressed && { transform: [{ scale: 0.96 }] }]}
        hitSlop={{ top: 4, bottom: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={down ? 'Retirer mon vote contre' : 'Voter contre (moins de publications de ce type, visible par vous seul)'}
        accessibilityState={{ selected: down }} aria-selected={down}
      >
        <ArrowBigDown size={22} color={down ? dark.gold : dark.textSecondary} fill={down ? dark.gold : 'transparent'} strokeWidth={1.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, backgroundColor: dark.subtle, minHeight: 44 },
  pillOwn: { paddingHorizontal: 12, gap: 4 },
  up: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 11, paddingRight: 4, minHeight: 44 },
  down: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 16, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
});
