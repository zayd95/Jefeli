/**
 * The quiet action row of a publication (P6, owner 21 Nov 2026): icons with a count, no boxes.
 *   ⭐ Noter · 💬 Commentaire · 🖤 · 👁 Vues (author only) · 🔖 Enregistrer · ↗ Partager
 *
 * ⭐ rates the publication 1–5 (private); the average is public only from 5 ratings, never who rated.
 * 🖤 is the former positive vote (the ▲/▼ pair is gone). 👁 is a real, server-side count shown to the
 * author only. All of them are optimistic with a rollback and a French error.
 */
import { formatCount, formatRatingAvg, toFrenchError } from '@jefeli/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Heart, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, Sheet, spacing, Text, useToast } from '@/design';
import { ratePost, votePost } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { cachedPost, patchPost } from '@/lib/postCache';
import type { PostCardData, VoteValue } from '@/lib/types';

const ICON = 20;

function Count({ value, color }: { value: string; color: string }) {
  return (
    <Text variant="callout" weight="600" color={color} style={styles.count}>
      {value}
    </Text>
  );
}

/** 🖤 One reversible heart per member (the positive vote). */
export function HeartButton({ post }: { post: PostCardData }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const on = post.my_vote === 1;
  const isOwn = post.author_id === userId;
  const count = post.upvote_count;
  const label = `${count} j’aime`;

  const vote = useMutation({
    mutationFn: (value: VoteValue) => votePost(post.id, value),
    onMutate: (value) => {
      const cur = cachedPost(qc, post.id) ?? post;
      const prev = { my_vote: cur.my_vote ?? 0, upvote_count: cur.upvote_count };
      patchPost(qc, post.id, () => ({ my_vote: value, upvote_count: Math.max(0, prev.upvote_count - (prev.my_vote === 1 ? 1 : 0) + (value === 1 ? 1 : 0)) }));
      return prev;
    },
    onError: (e, _v, prev) => {
      if (prev) patchPost(qc, post.id, () => prev);
      toast(toFrenchError(e), 'error');
    },
    onSuccess: (res) => patchPost(qc, post.id, () => ({ my_vote: res.my_vote, upvote_count: res.upvote_count })),
  });

  if (isOwn) {
    return (
      <View style={styles.item} accessible accessibilityLabel={label}>
        <Heart size={ICON} color={dark.textSecondary} strokeWidth={1.7} />
        <Count value={formatCount(count)} color={dark.textSecondary} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => userId && !vote.isPending && vote.mutate(on ? 0 : 1)}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={on ? `Retirer mon j’aime. ${label}` : `Aimer. ${label}`}
      accessibilityState={{ selected: on }}
      aria-selected={on}
      testID="act-heart"
    >
      <Heart size={ICON} color={on ? colors.red : dark.textStrong} fill={on ? colors.red : 'transparent'} strokeWidth={1.7} />
      <Count value={formatCount(count)} color={on ? colors.red : dark.textStrong} />
    </Pressable>
  );
}

/** ⭐ Rate 1–5. Opens a small sheet; the average shows from 5 ratings. */
export function RateButton({ post }: { post: PostCardData }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const mine = post.my_rating ?? 0;
  const isOwn = post.author_id === userId;
  const avg = post.rating_avg;
  const summary =
    avg != null
      ? `Note moyenne ${formatRatingAvg(avg)} sur 5, ${post.rating_count} notes`
      : post.rating_count > 0
        ? `${post.rating_count} note${post.rating_count > 1 ? 's' : ''}, moyenne dès 5 notes`
        : 'Pas encore noté';

  const rate = useMutation({
    mutationFn: (value: number) => ratePost(post.id, value),
    onMutate: (value) => {
      const cur = cachedPost(qc, post.id) ?? post;
      const prev = { my_rating: cur.my_rating ?? 0, rating_count: cur.rating_count, rating_avg: cur.rating_avg };
      const delta = (value > 0 ? 1 : 0) - (prev.my_rating > 0 ? 1 : 0);
      patchPost(qc, post.id, () => ({ my_rating: value, rating_count: Math.max(0, prev.rating_count + delta) }));
      return prev;
    },
    onError: (e, _v, prev) => {
      if (prev) patchPost(qc, post.id, () => prev);
      toast(toFrenchError(e), 'error');
    },
    onSuccess: (res) => patchPost(qc, post.id, () => ({ my_rating: res.my_rating, rating_count: res.rating_count, rating_avg: res.rating_avg })),
  });

  const value = avg != null ? formatRatingAvg(avg) : '';
  if (isOwn) {
    return (
      <View style={styles.item} accessible accessibilityLabel={summary}>
        <Star size={ICON} color={dark.textSecondary} strokeWidth={1.7} />
        {value ? <Count value={value} color={dark.textSecondary} /> : null}
      </View>
    );
  }
  return (
    <>
      <Pressable
        onPress={() => userId && setOpen(true)}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={mine > 0 ? `Votre note : ${mine} sur 5. Modifier. ${summary}` : `Noter la publication. ${summary}`}
        testID="act-rate"
      >
        <Star size={ICON} color={mine > 0 ? dark.gold : dark.textStrong} fill={mine > 0 ? dark.gold : 'transparent'} strokeWidth={1.7} />
        {value ? <Count value={value} color={mine > 0 ? dark.gold : dark.textStrong} /> : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Noter cette publication" tone="dark">
        <View style={styles.stars} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                setOpen(false);
                if (n !== mine) rate.mutate(n);
              }}
              style={({ pressed }) => [styles.star, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityLabel={`${n} sur 5`}
              accessibilityState={{ checked: mine === n }}
              aria-checked={mine === n}
              testID={`rate-${n}`}
            >
              <Star size={34} color={n <= mine ? dark.gold : dark.textSecondary} fill={n <= mine ? dark.gold : 'transparent'} strokeWidth={1.6} />
            </Pressable>
          ))}
        </View>
        <Text variant="caption" tone="fogSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Votre note reste privée. La moyenne s’affiche dès 5 notes.
        </Text>
        {mine > 0 ? (
          <Pressable
            onPress={() => {
              setOpen(false);
              rate.mutate(0);
            }}
            style={styles.remove}
            accessibilityRole="button"
            testID="rate-remove"
          >
            <Text variant="callout" weight="700" tone="fog">
              Retirer ma note
            </Text>
          </Pressable>
        ) : null}
      </Sheet>
    </>
  );
}

/** 👁 Real views, shown to the author of the publication only. */
export function ViewsCount({ post }: { post: PostCardData }) {
  const n = post.my_views;
  if (n == null) return null;
  return (
    <View style={styles.item} accessible accessibilityLabel={`${n} vue${n > 1 ? 's' : ''}, visibles par vous seul`} testID="act-views">
      <Eye size={ICON} color={dark.textSecondary} strokeWidth={1.7} />
      <Count value={formatCount(n)} color={dark.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 22 },
  pressed: { transform: [{ scale: 0.94 }] },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26 },
  remove: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
});
