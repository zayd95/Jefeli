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

import { colors, radius, Text, useToast } from '@/design';
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
        <ArrowBigUp size={20} color={colors.textSecondary} strokeWidth={2} />
        <Text variant="callout" weight="700" tone="secondary">
          {formatCount(count)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.pill, up && styles.pillUp]}>
      <Pressable
        onPress={() => press(1)}
        style={styles.half}
        hitSlop={{ top: 8, bottom: 8, left: 6 }}
        accessibilityRole="button"
        accessibilityLabel={up ? `Retirer mon vote pour. ${countLabel}` : `Voter pour. ${countLabel}`}
        accessibilityState={{ selected: up }} aria-selected={up}
      >
        <ArrowBigUp size={21} color={up ? colors.accentDeep : colors.ink} fill={up ? colors.accentDeep : 'transparent'} strokeWidth={2} />
        <Text variant="callout" weight="700" color={up ? colors.accentDeep : colors.ink} style={styles.count}>
          {count > 0 ? formatCount(count) : 'Voter'}
        </Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        onPress={() => press(-1)}
        style={[styles.half, styles.downHalf]}
        hitSlop={{ top: 8, bottom: 8, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={down ? 'Retirer mon vote contre' : 'Voter contre (moins de publications de ce type, visible par vous seul)'}
        accessibilityState={{ selected: down }} aria-selected={down}
      >
        <ArrowBigDown size={21} color={down ? colors.inkSoft : colors.textSecondary} fill={down ? colors.inkSoft : 'transparent'} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    minHeight: 38,
    paddingHorizontal: 4,
  },
  pillUp: { backgroundColor: colors.mintSoft },
  pillOwn: { paddingHorizontal: 12, gap: 4 },
  half: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 38 },
  downHalf: { paddingHorizontal: 8 },
  count: { minWidth: 12 },
  divider: { width: 1, height: 18, backgroundColor: colors.borderStrong },
});
