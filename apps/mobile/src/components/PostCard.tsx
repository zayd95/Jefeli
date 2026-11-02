import { FEED_REASON_LABELS, formatCount, formatXOF, INTENT_LABELS, isPostIntent, timeAgo, toFrenchError, type PostIntent } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, HandHelping, MessageCircle, MessageCircleQuestionMark, MoreHorizontal, Search, Send, type LucideIcon } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, colors, IconButton, radius, spacing, Text, useToast } from '@/design';
import { openConversationWith } from '@/lib/api/messages';
import { deletePost, setSave } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { patchPost } from '@/lib/postCache';
import { shareLinks } from '@/lib/share';
import type { CommentPreview, PostCardData } from '@/lib/types';

import { ContentMenu } from './ContentMenu';
import { MediaCarousel, Thumb } from './Media';
import { ProfileName } from './ProfileName';
import { VoteControl } from './VoteControl';

const INTENT_STYLE: Record<Exclude<PostIntent, 'share'>, { icon: LucideIcon; bg: string; fg: string }> = {
  seek: { icon: Search, bg: colors.mintSoft, fg: colors.ink },
  offer: { icon: HandHelping, bg: colors.warningSoft, fg: colors.warning },
  opinion: { icon: MessageCircleQuestionMark, bg: colors.surfaceMuted, fg: colors.ink },
};

function PostCardInner({ post, showReason = true, onOpenComments }: { post: PostCardData; showReason?: boolean; onOpenComments?: () => void }) {
  const { userId } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [contacting, setContacting] = useState(false);
  const author = post.author;
  if (!author) return null;

  const inFeed = !onOpenComments; // the post screen lists every comment below the card
  const bucket = post.media[0]?.bucket === 'private-media' ? 'private-media' : 'public-media';
  const reason = showReason && post.reason ? FEED_REASON_LABELS[post.reason] : null;
  const tagged = post.tagged.map((t) => t.product).filter(Boolean);
  const long = post.body.length > 180;
  const intent: PostIntent = isPostIntent(post.intent) ? post.intent : 'share';
  const isOwn = post.author_id === userId;
  const firstName = author.display_name.split(' ')[0] ?? author.display_name;
  const previews = post.comments_preview ?? [];
  const openPost = (focusComment = false) =>
    router.push({ pathname: '/post/[id]', params: focusComment ? { id: post.id, comment: '1' } : { id: post.id } });

  async function toggleSave() {
    if (!userId) return;
    const next = !post.saved;
    patchPost(qc, post.id, () => ({ saved: next }));
    try {
      await setSave(userId, post.id, next);
      toast(next ? 'Enregistré' : 'Retiré des enregistrements', 'success');
      qc.invalidateQueries({ queryKey: ['saved-posts'] });
    } catch (e) {
      patchPost(qc, post.id, () => ({ saved: !next }));
      toast(toFrenchError(e), 'error');
    }
  }

  async function contactAuthor() {
    if (!userId || contacting || !author) return;
    setContacting(true);
    try {
      const conversationId = await openConversationWith(author.id);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setContacting(false);
    }
  }

  const visibilityLabel = post.visibility === 'friends' ? ' · Amis' : post.visibility === 'followers' ? ' · Abonnés' : '';
  const intentStyle = intent === 'share' ? null : INTENT_STYLE[intent];
  // A contextual next step for requests and offers; ordinary shares keep the product « Voir » card.
  const cta =
    isOwn || intent === 'share'
      ? null
      : intent === 'opinion'
        ? { label: 'Donner mon avis', onPress: () => (onOpenComments ? onOpenComments() : openPost(true)) }
        : intent === 'seek'
          ? { label: 'Je peux aider', hint: `Écrire à ${firstName} en privé`, onPress: contactAuthor }
          : { label: `Écrire à ${firstName}`, onPress: contactAuthor };

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

      {intentStyle ? (
        <View style={[styles.intent, { backgroundColor: intentStyle.bg }]} accessibilityLabel={`Type de publication : ${INTENT_LABELS[intent]}`}>
          <intentStyle.icon size={15} color={intentStyle.fg} strokeWidth={2.2} />
          <Text variant="caption" weight="700" color={intentStyle.fg}>
            {INTENT_LABELS[intent]}
          </Text>
        </View>
      ) : null}

      {post.media.length > 0 ? (
        <Pressable onPress={() => openPost()} accessibilityLabel="Ouvrir la publication" disabled={post.media[0]?.kind === 'video'}>
          <MediaCarousel media={post.media} bucket={bucket} />
        </Pressable>
      ) : null}

      <View style={styles.body}>
        {post.body ? (
          <Pressable onPress={() => (long && !expanded ? setExpanded(true) : openPost())}>
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

        {cta ? (
          <Pressable
            onPress={cta.onPress}
            disabled={contacting}
            style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.actionPressed }, contacting && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={cta.hint ? `${cta.label}. ${cta.hint}` : cta.label}
          >
            <Text variant="callout" weight="700" color={colors.actionText}>
              {cta.label}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionGroup}>
            <VoteControl post={post} />
            <Pressable
              onPress={onOpenComments ?? (() => openPost(post.comment_count === 0))}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={post.comment_count > 0 ? `Commentaires, ${post.comment_count}` : 'Commenter'}
              hitSlop={6}
            >
              <MessageCircle size={22} color={colors.ink} strokeWidth={2} />
              <Text variant="callout" weight="600">
                {post.comment_count > 0 ? formatCount(post.comment_count) : 'Commenter'}
              </Text>
            </Pressable>
            {post.visibility === 'public' ? (
              <Pressable onPress={() => shareLinks.post(post.id, author.display_name)} style={styles.action} accessibilityRole="button" accessibilityLabel="Partager" hitSlop={6}>
                <Send size={21} color={colors.ink} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={toggleSave} style={styles.action} accessibilityRole="button" accessibilityLabel={post.saved ? 'Retirer des enregistrements' : 'Enregistrer'} hitSlop={6}>
            <Bookmark size={22} color={colors.ink} fill={post.saved ? colors.ink : 'transparent'} strokeWidth={2} />
          </Pressable>
        </View>

        {inFeed && (previews.length > 0 || post.comment_count > 0) ? (
          <CommentPreviewList post={post} previews={previews} onOpen={() => openPost()} />
        ) : null}
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

/** Genuine recent comments (newest first, max 2), filtered by the server for blocks and moderation. */
function CommentPreviewList({ post, previews, onOpen }: { post: PostCardData; previews: CommentPreview[]; onOpen: () => void }) {
  const more = post.comment_count - previews.length;
  return (
    <View style={styles.previews}>
      {more > 0 ? (
        <Pressable onPress={onOpen} accessibilityRole="button" hitSlop={4}>
          <Text variant="callout" tone="secondary" weight="600">
            {previews.length === 0
              ? `Voir ${post.comment_count === 1 ? 'le commentaire' : `les ${post.comment_count} commentaires`}`
              : `Voir ${more === 1 ? 'l’autre commentaire' : `les ${more} autres commentaires`}`}
          </Text>
        </Pressable>
      ) : null}
      {previews.map((c) => (
        <Pressable key={c.comment_id} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Commentaire de ${c.author.display_name} : ${c.body}`}>
          <Text variant="callout" numberOfLines={2}>
            <Text variant="callout" weight="700">
              {c.author.display_name}
            </Text>
            {c.by_post_author ? (
              <Text variant="caption" weight="700" color={colors.accentDeep}>
                {' '}· Auteur
              </Text>
            ) : null}{' '}
            {c.body}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.xs, paddingVertical: spacing.sm },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: 44 },
  intent: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
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
  cta: { alignSelf: 'flex-start', backgroundColor: colors.action, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, minWidth: 32 },
  previews: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
