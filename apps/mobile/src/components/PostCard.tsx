import { FEED_REASON_LABELS, formatCount, formatXOF, timeAgo, toFrenchError } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, colors, IconButton, radius, spacing, Text, useToast } from '@/design';
import { deletePost, setLike, setSave } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { shareLinks } from '@/lib/share';
import type { PostCardData } from '@/lib/types';

import { ContentMenu } from './ContentMenu';
import { MediaCarousel, Thumb } from './Media';
import { ProfileName } from './ProfileName';

function PostCardInner({ post, showReason = true, onOpenComments }: { post: PostCardData; showReason?: boolean; onOpenComments?: () => void }) {
  const { userId } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(!!post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [saved, setSaved] = useState(!!post.saved);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const author = post.author;
  if (!author) return null;

  const bucket = post.media[0]?.bucket === 'private-media' ? 'private-media' : 'public-media';
  const reason = showReason && post.reason ? FEED_REASON_LABELS[post.reason] : null;
  const tagged = post.tagged.map((t) => t.product).filter(Boolean);
  const long = post.body.length > 180;

  async function toggleLike() {
    if (!userId) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await setLike(userId, post.id, next);
    } catch (e) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast(toFrenchError(e), 'error');
    }
  }

  async function toggleSave() {
    if (!userId) return;
    const next = !saved;
    setSaved(next);
    try {
      await setSave(userId, post.id, next);
      toast(next ? 'Enregistré' : 'Retiré des enregistrements', 'success');
      qc.invalidateQueries({ queryKey: ['saved-posts'] });
    } catch (e) {
      setSaved(!next);
      toast(toFrenchError(e), 'error');
    }
  }

  const visibilityLabel = post.visibility === 'friends' ? ' · Amis' : post.visibility === 'followers' ? ' · Abonnés' : '';

  return (
    <View style={styles.card}>
      <View style={styles.author}>
        <Pressable
          style={styles.authorLeft}
          onPress={() => router.push(`/u/${author.handle}`)}
          accessibilityRole="button"
          accessibilityLabel={`Profil de ${author.display_name}`}
        >
          <Avatar path={author.avatar_path} name={author.display_name} size={38} />
          <View style={{ flexShrink: 1 }}>
            <ProfileName profile={author} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {[post.city, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
              {visibilityLabel}
              {reason ? ` · ${reason}` : ''}
            </Text>
          </View>
        </Pressable>
        <IconButton icon={MoreHorizontal} label="Plus d’options" onPress={() => setMenu(true)} color={colors.textSecondary} />
      </View>

      {post.media.length > 0 ? (
        <Pressable onPress={() => router.push(`/post/${post.id}`)} accessibilityLabel="Ouvrir la publication" disabled={post.media[0]?.kind === 'video'}>
          <MediaCarousel media={post.media} bucket={bucket} />
        </Pressable>
      ) : null}

      <View style={styles.body}>
        {post.body ? (
          <Pressable onPress={() => (long && !expanded ? setExpanded(true) : router.push(`/post/${post.id}`))}>
            <Text variant={post.media.length === 0 ? 'headline' : 'body'} weight={post.media.length === 0 ? '500' : '400'} numberOfLines={expanded ? undefined : 4}>
              {post.body}
            </Text>
            {long && !expanded ? (
              <Text variant="callout" tone="secondary" weight="600">
                … voir plus
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {tagged.length > 0
          ? tagged.slice(0, 2).map((p) =>
              p ? (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/p/${p.id}`)}
                  style={({ pressed }) => [styles.product, pressed && { backgroundColor: colors.surfaceSubtle }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir l’article ${p.title}`}
                >
                  <Thumb media={[...p.media].sort((a, b) => a.position - b.position)[0]} style={styles.productThumb} />
                  <View style={{ flex: 1 }}>
                    <Text variant="callout" weight="600" numberOfLines={1}>
                      {p.title}
                    </Text>
                    {p.price_xof !== null ? (
                      <Text variant="price" style={{ fontSize: 18, lineHeight: 23 }}>
                        {formatXOF(p.price_xof)}
                      </Text>
                    ) : (
                      <Text variant="callout" tone="secondary">
                        À échanger
                      </Text>
                    )}
                    {p.status !== 'active' ? (
                      <Text variant="caption" tone="secondary" weight="600">
                        {p.status === 'sold' ? 'Vendu' : p.status === 'reserved' ? 'Réservé' : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="callout" weight="700">
                    Voir →
                  </Text>
                </Pressable>
              ) : null,
            )
          : null}

        <View style={styles.actions}>
          <View style={styles.actionGroup}>
            <Pressable onPress={toggleLike} style={styles.action} accessibilityRole="button" accessibilityLabel={liked ? 'Je n’aime plus' : 'J’aime'} accessibilityState={{ selected: liked }} hitSlop={6}>
              <Heart size={23} color={liked ? colors.danger : colors.ink} fill={liked ? colors.danger : 'transparent'} strokeWidth={2} />
              {likes > 0 ? (
                <Text variant="callout" weight="600">
                  {formatCount(likes)}
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              onPress={onOpenComments ?? (() => router.push(`/post/${post.id}`))}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={`Commentaires, ${post.comment_count}`}
              hitSlop={6}
            >
              <MessageCircle size={23} color={colors.ink} strokeWidth={2} />
              {post.comment_count > 0 ? (
                <Text variant="callout" weight="600">
                  {formatCount(post.comment_count)}
                </Text>
              ) : null}
            </Pressable>
            {post.visibility === 'public' ? (
              <Pressable onPress={() => shareLinks.post(post.id, author.display_name)} style={styles.action} accessibilityRole="button" accessibilityLabel="Partager" hitSlop={6}>
                <Send size={22} color={colors.ink} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={toggleSave} style={styles.action} accessibilityRole="button" accessibilityLabel={saved ? 'Retirer des enregistrements' : 'Enregistrer'} hitSlop={6}>
            <Bookmark size={22} color={colors.ink} fill={saved ? colors.ink : 'transparent'} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={author.id}
        ownerName={author.display_name}
        target={{ type: 'post', id: post.id }}
        onShare={post.visibility === 'public' ? () => shareLinks.post(post.id, author.display_name) : undefined}
        onEdit={() => router.push({ pathname: '/post/[id]', params: { id: post.id, edit: '1' } })}
        onDelete={async () => {
          await deletePost(post.id);
          qc.invalidateQueries({ queryKey: ['feed'] });
          qc.invalidateQueries({ queryKey: ['user-posts', author.id] });
        }}
      />
    </View>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: 44 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  productThumb: { width: 56, height: 56, borderRadius: radius.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, minWidth: 32 },
});
