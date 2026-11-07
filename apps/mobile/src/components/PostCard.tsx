/**
 * Social post card, ported from the approved Lovable feed (Atlantic After Dark):
 *   - no white card: posts sit on #091B19, separated by air;
 *   - author row, then a quiet uppercase eyebrow with a coloured dot (« Demande d’aide »,
 *     « Je propose », « Vitrine », « Moment »…);
 *   - text-only posts become a restrained patterned card with the words in the editorial serif;
 *   - media posts are full-bleed at their genuine aspect ratio, a tagged article floats on the
 *     photo as a glass chip;
 *   - the vote pill, comments, share, save, and one mint text action (« Écrire » / « Demander »).
 * Every behaviour of the native card is kept: votes, saves, pins, edit/delete, report and block
 * menu, private replies, product conversations and genuine comment previews.
 */
import { FEED_REASON_LABELS, formatCount, formatListingPrice, INTENT_LABELS, isPostIntent, timeAgo, toFrenchError, type PostIntent } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, MessageCircle, MoreHorizontal, Pin, Send, Share2 } from 'lucide-react-native';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Avatar, colors, dark, IconButton, Motif, radius, spacing, Text, useToast } from '@/design';
import { messageAboutProduct, openConversationWith } from '@/lib/api/messages';
import { deletePost, setPinned, setSave } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { useMediaUrl } from '@/lib/media';
import { patchPost } from '@/lib/postCache';
import { shareLinks } from '@/lib/share';
import type { CommentPreview, PostCardData } from '@/lib/types';

import { NarrationBar, VoiceCard } from './audio/Voice';
import { ContentMenu } from './ContentMenu';
import { MediaCarousel, Thumb, useIsActivePost } from './Media';
import { PriceLabel } from './PriceLabel';
import { ProfileName } from './ProfileName';
import { ShareToStatusSheet } from './ShareToStatus';
import { VoteControl } from './VoteControl';

type Eyebrow = { label: string; dot: string };

function eyebrowFor(intent: PostIntent, post: PostCardData, tagged: boolean): Eyebrow {
  if (intent === 'seek') return { label: 'Demande d’aide', dot: dark.gold };
  if (intent === 'offer') return { label: INTENT_LABELS.offer, dot: dark.mint };
  if (intent === 'opinion') return { label: INTENT_LABELS.opinion, dot: dark.textSecondary };
  if (tagged) return { label: 'Vitrine', dot: dark.mint };
  const voice = post.media.some((m) => m.kind === 'audio');
  const visual = post.media.filter((m) => m.kind !== 'audio');
  if (visual[0]?.kind === 'video') return { label: 'Vidéo', dot: dark.textSecondary };
  if (visual.length > 0 && voice) return { label: 'Photos racontées', dot: dark.mint };
  if (visual.length > 0) return { label: 'Moment', dot: dark.textSecondary };
  if (voice) return { label: 'Publication vocale', dot: dark.mint };
  return { label: 'Publication', dot: dark.textSecondary };
}

type Cue = { t: number; i: number };
/** « Visite guidée » cues from the database (validated there), sorted by time. */
function parseCues(raw: unknown): Cue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Cue => typeof c === 'object' && c !== null && typeof (c as Cue).t === 'number' && typeof (c as Cue).i === 'number')
    .sort((a, b) => a.t - b.t);
}
function photoAt(cues: Cue[], ms: number): number {
  let i = cues[0]?.i ?? 0;
  for (const c of cues) if (c.t <= ms) i = c.i;
  return i;
}

function PostCardInner({
  post,
  showReason = true,
  showPinned = false,
  onOpenComments,
}: {
  post: PostCardData;
  showReason?: boolean;
  /** Profile timeline only: label posts the author pinned. */
  showPinned?: boolean;
  onOpenComments?: () => void;
}) {
  const { userId } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [contacting, setContacting] = useState(false);
  const activeOnScreen = useIsActivePost(post.id);
  const voice = post.media.find((m) => m.kind === 'audio') ?? null;
  const voiceUri = useMediaUrl(post.media[0]?.bucket === 'private-media' ? 'private-media' : 'public-media', voice?.storage_path);
  const cues = useMemo(() => parseCues(voice?.cues), [voice?.cues]);
  // The gallery follows the narration until the member swipes it themselves.
  const [following, setFollowing] = useState(true);
  const [cuePhoto, setCuePhoto] = useState<number | undefined>(undefined);
  const author = post.author;
  if (!author) return null;

  const inFeed = !onOpenComments; // the post screen lists every comment below the card
  const bucket = post.media[0]?.bucket === 'private-media' ? 'private-media' : 'public-media';
  const reason = showReason && post.reason ? FEED_REASON_LABELS[post.reason] : null;
  const tagged = post.tagged.map((t) => t.product).filter((p): p is NonNullable<typeof p> => !!p);
  const intent: PostIntent = isPostIntent(post.intent) ? post.intent : 'share';
  const isOwn = post.author_id === userId;
  const firstName = author.display_name.split(' ')[0] ?? author.display_name;
  const previews = post.comments_preview ?? [];
  const visual = post.media.filter((m) => m.kind !== 'audio');
  const hasMedia = visual.length > 0;
  const onNarration = (ms: number, playing: boolean) => {
    if (cues.length < 2) return;
    if (playing && ms < 300 && !following) setFollowing(true);
    if (!playing && ms === 0) return;
    const i = photoAt(cues, ms);
    if (i !== cuePhoto) setCuePhoto(i);
  };
  const long = post.body.length > (hasMedia ? 180 : 260);
  const eyebrow = eyebrowFor(intent, post, tagged.length > 0);
  const mediaWidth = Math.min(screenWidth, 640);
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

  async function contactAboutProduct(productId: string) {
    if (!userId || contacting) return;
    setContacting(true);
    try {
      const conversationId = await messageAboutProduct(productId);
      router.push(`/chat/${conversationId}?about=${productId}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setContacting(false);
    }
  }

  async function togglePinned() {
    const next = !post.pinned_at;
    try {
      await setPinned('post', post.id, next);
      toast(next ? 'Épinglé en haut de votre profil' : 'Retiré du haut de votre profil', 'success');
      qc.invalidateQueries({ queryKey: ['user-posts', post.author_id] });
      qc.invalidateQueries({ queryKey: ['pinned-posts', post.author_id] });
      patchPost(qc, post.id, () => ({ pinned_at: next ? new Date().toISOString() : null }));
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  const visibilityLabel = post.visibility === 'friends' ? 'Amis' : post.visibility === 'followers' ? 'Abonnés' : null;
  // The first tagged article still available from someone else: « Demander » opens a product conversation.
  const askable = !isOwn && intent === 'share' ? tagged.find((p) => p.seller_id !== userId && p.status !== 'sold') : undefined;
  // A contextual next step for requests and offers (Lovable « Je peux aider » in gold for requests).
  const cta =
    isOwn || intent === 'share'
      ? null
      : intent === 'opinion'
        ? { label: 'Donner mon avis', hint: undefined, tone: 'outline' as const, onPress: () => (onOpenComments ? onOpenComments() : openPost(true)) }
        : intent === 'seek'
          ? { label: 'Je peux aider', hint: `Écrire à ${firstName} en privé`, tone: 'gold' as const, onPress: contactAuthor }
          : { label: `Écrire à ${firstName}`, hint: undefined, tone: 'mint' as const, onPress: contactAuthor };
  // One quiet mint text action on the vote row (Lovable « Écrire » / « Demander »), for ordinary shares.
  const rowAction = isOwn || intent !== 'share' ? null : askable ? { label: 'Demander', onPress: () => contactAboutProduct(askable.id), a11y: `Écrire au vendeur à propos de ${askable.title}` } : { label: 'Écrire', onPress: contactAuthor, a11y: `Écrire à ${firstName} en privé` };

  const ctaButton = cta ? (
    <Pressable
      onPress={cta.onPress}
      disabled={contacting}
      style={({ pressed }) => [styles.cta, cta.tone === 'gold' ? styles.ctaGold : cta.tone === 'mint' ? styles.ctaMint : styles.ctaOutline, pressed && { transform: [{ scale: 0.97 }] }, contacting && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={cta.hint ? `${cta.label}. ${cta.hint}` : cta.label}
    >
      <Text variant="callout" weight="700" color={cta.tone === 'outline' ? dark.text : colors.night}>
        {cta.label}
      </Text>
    </Pressable>
  ) : null;

  const bodyText = post.body ? (
    <Pressable onPress={() => (long && !expanded ? setExpanded(true) : openPost())} accessibilityHint="Ouvrir la publication">
      <Text variant="body" color={dark.textStrong} numberOfLines={expanded ? undefined : 4} style={{ lineHeight: 23 }}>
        {post.body}
      </Text>
      {long && !expanded ? (
        <Text variant="callout" tone="fogSecondary" weight="600">
          … voir plus
        </Text>
      ) : null}
    </Pressable>
  ) : null;

  return (
    <View style={styles.card}>
      {showPinned && post.pinned_at ? (
        <View style={styles.pinned}>
          <Pin size={13} color={dark.gold} strokeWidth={2.4} />
          <Text variant="caption" tone="gold" weight="700">
            Épinglé
          </Text>
        </View>
      ) : null}
      <View style={styles.author}>
        <Pressable
          style={styles.authorLeft}
          onPress={() => router.push(`/u/${author.handle}`)}
          accessibilityRole="button"
          accessibilityLabel={`Profil de ${author.display_name}`}
        >
          <Avatar path={author.avatar_path} name={author.display_name} size={40} />
          <View style={{ flexShrink: 1, gap: 1 }}>
            <ProfileName profile={author} tone="dark" />
            <Text variant="caption" tone="fogSecondary" numberOfLines={1} style={{ fontSize: 12 }}>
              {[post.city, timeAgo(post.created_at), visibilityLabel, reason].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
        <IconButton icon={MoreHorizontal} label="Plus d’options" onPress={() => setMenu(true)} color={dark.textSecondary} />
      </View>

      <View
        style={styles.eyebrow}
        accessible={intent !== 'share'}
        accessibilityLabel={intent !== 'share' ? `Type de publication : ${INTENT_LABELS[intent]}` : undefined}
      >
        <View style={[styles.eyebrowDot, { backgroundColor: eyebrow.dot }]} />
        <Text variant="micro" weight="700" tone="fogSecondary" style={styles.eyebrowText}>
          {eyebrow.label.toUpperCase()}
        </Text>
      </View>

      {!hasMedia && voice ? (
        // W1.2 voice publication: the words above (for those who cannot listen), then the voice card.
        <>
          {bodyText ? <View style={styles.bodyAbove}>{bodyText}</View> : null}
          <VoiceCard uri={voiceUri} durationMs={voice.duration_ms} waveform={voice.waveform} language={voice.language} active={activeOnScreen} />
          {ctaButton ? <View style={styles.ctaBelow}>{ctaButton}</View> : null}
        </>
      ) : !hasMedia ? (
        // Lovable text card: deep surface, woven motif, words in the editorial serif.
        <View style={styles.quote}>
          <Motif />
          {post.body ? (
            <Pressable onPress={() => (long && !expanded ? setExpanded(true) : openPost())} accessibilityHint="Ouvrir la publication">
              <Text serif weight="400" color={dark.text} numberOfLines={expanded ? undefined : 8} style={styles.quoteText}>
                {'« '}
                <Text serif weight="400" color={dark.text} style={styles.quoteText}>
                  {post.body}
                </Text>
                {' »'}
              </Text>
              {long && !expanded ? (
                <Text variant="callout" tone="fogSecondary" weight="600" style={{ marginTop: 4 }}>
                  … voir plus
                </Text>
              ) : null}
            </Pressable>
          ) : null}
          {ctaButton ? (
            <View style={styles.quoteActions}>
              {ctaButton}
              {intent === 'seek' ? (
                <Text variant="caption" tone="fogSecondary" style={{ flex: 1 }}>
                  ou recommandez quelqu’un en commentaire
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <>
          {bodyText ? <View style={styles.bodyAbove}>{bodyText}</View> : null}
          <View>
            {post.media[0]?.kind === 'video' ? (
              // A video handles its own taps (play, pause, sound): no disabled wrapper around it, which
              // screen readers would announce as « dimmed » for the play button too.
              <MediaCarousel media={visual} bucket={bucket} width={mediaWidth} tone="dark" active={activeOnScreen} />
            ) : (
              <Pressable onPress={() => openPost()} accessibilityLabel="Ouvrir la publication">
                <MediaCarousel
                  media={visual}
                  bucket={bucket}
                  width={mediaWidth}
                  tone="dark"
                  active={activeOnScreen}
                  index={voice && following ? cuePhoto : undefined}
                  onUserSwipe={() => setFollowing(false)}
                />
              </Pressable>
            )}
            {voice ? <NarrationBar uri={voiceUri} durationMs={voice.duration_ms} waveform={voice.waveform} language={voice.language} active={activeOnScreen} onPosition={onNarration} /> : null}
            {tagged[0] ? (
              <Pressable
                onPress={() => router.push(`/p/${tagged[0]!.id}`)}
                style={({ pressed }) => [styles.productChip, voice ? styles.productChipTop : styles.productChipBottom, pressed && { transform: [{ scale: 0.97 }] }]}
                accessibilityRole="button"
                accessibilityLabel={`Voir l’article ${tagged[0].title}, ${formatListingPrice(tagged[0])}`}
              >
                <Thumb media={[...tagged[0].media].sort((a, b) => a.position - b.position)[0]} style={styles.productChipThumb} />
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <Text variant="caption" weight="600" tone="fog" numberOfLines={1} style={{ fontSize: 13 }}>
                    {tagged[0].title}
                  </Text>
                  {tagged[0].status === 'sold' || tagged[0].status === 'reserved' ? (
                    <Text variant="caption" weight="700" tone="gold">
                      {tagged[0].status === 'sold' ? 'Vendu' : 'Réservé'}
                    </Text>
                  ) : (
                    <PriceLabel product={tagged[0]} size="card" compact tone="dark" style={{ fontSize: 13, lineHeight: 17 }} />
                  )}
                </View>
              </Pressable>
            ) : null}
          </View>
          {ctaButton ? <View style={styles.ctaBelow}>{ctaButton}</View> : null}
        </>
      )}

      {/* Further tagged articles (or the first one on a text post) as quiet dark rows. */}
      {tagged.slice(hasMedia ? 1 : 0, 2).map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/p/${p.id}`)}
          style={({ pressed }) => [styles.productRow, pressed && { backgroundColor: dark.raised }]}
          accessibilityRole="button"
          accessibilityLabel={`Voir l’article ${p.title}, ${formatListingPrice(p)}`}
        >
          <Thumb media={[...p.media].sort((a, b) => a.position - b.position)[0]} style={styles.productRowThumb} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="callout" weight="600" tone="fog" numberOfLines={1}>
              {p.title}
            </Text>
            {p.status !== 'active' ? (
              <Text variant="caption" tone="gold" weight="700">
                {p.status === 'sold' ? 'Vendu' : p.status === 'reserved' ? 'Réservé' : ''}
              </Text>
            ) : (
              <PriceLabel product={p} size="card" tone="dark" />
            )}
          </View>
          <Text variant="caption" weight="700" tone="mint">
            Voir
          </Text>
        </Pressable>
      ))}

      <View style={styles.actions}>
        <VoteControl post={post} />
        <Pressable
          onPress={onOpenComments ?? (() => openPost(post.comment_count === 0))}
          style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.96 }] }]}
          accessibilityRole="button"
          accessibilityLabel={post.comment_count > 0 ? `Commentaires, ${post.comment_count}` : 'Commenter'}
          hitSlop={4}
        >
          <MessageCircle size={20} color={dark.textStrong} strokeWidth={1.7} />
          <Text variant="callout" weight="600" color={dark.textStrong} style={{ fontSize: 13 }}>
            {formatCount(post.comment_count)}
          </Text>
        </Pressable>
        {post.visibility === 'public' ? (
          <Pressable onPress={() => shareLinks.post(post.id, author.display_name)} style={styles.iconAction} accessibilityRole="button" accessibilityLabel="Partager" hitSlop={4}>
            <Share2 size={20} color={dark.textStrong} strokeWidth={1.7} />
          </Pressable>
        ) : null}
        <Pressable onPress={toggleSave} style={styles.iconAction} accessibilityRole="button" accessibilityLabel={post.saved ? 'Retirer des enregistrements' : 'Enregistrer'} hitSlop={4}>
          <Bookmark size={20} color={post.saved ? dark.mint : dark.textStrong} fill={post.saved ? dark.mint : 'transparent'} strokeWidth={1.7} />
        </Pressable>
        {rowAction ? (
          <Pressable
            onPress={rowAction.onPress}
            disabled={contacting}
            style={({ pressed }) => [styles.rowAction, pressed && { transform: [{ scale: 0.96 }] }, contacting && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={rowAction.a11y}
          >
            <Send size={16} color={dark.mint} strokeWidth={2} />
            <Text variant="callout" weight="700" tone="mint" style={{ fontSize: 13 }}>
              {rowAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {inFeed && (previews.length > 0 || post.comment_count > 0) ? (
        <CommentPreviewList post={post} previews={previews} onOpen={() => openPost()} />
      ) : null}

      <ContentMenu
        visible={menu}
        onClose={() => setMenu(false)}
        ownerId={author.id}
        ownerName={author.display_name}
        target={{ type: 'post', id: post.id }}
        onShare={post.visibility === 'public' ? () => shareLinks.post(post.id, author.display_name) : undefined}
        onEdit={() => router.push({ pathname: '/post/[id]', params: { id: post.id, edit: '1' } })}
        pin={{ pinned: !!post.pinned_at, onToggle: togglePinned }}
        onShareToStatus={() => setStatusSheet(true)}
        onDelete={async () => {
          await deletePost(post.id);
          qc.invalidateQueries({ queryKey: ['feed'] });
          qc.invalidateQueries({ queryKey: ['user-posts', author.id] });
        }}
      />
      {isOwn ? <ShareToStatusSheet visible={statusSheet} onClose={() => setStatusSheet(false)} target={{ postId: post.id, visibility: post.visibility }} /> : null}
    </View>
  );
}

/** Genuine recent comments (newest first, max 2), filtered by the server for blocks and moderation. */
function CommentPreviewList({ post, previews, onOpen }: { post: PostCardData; previews: CommentPreview[]; onOpen: () => void }) {
  const more = post.comment_count - previews.length;
  return (
    <View style={styles.previews}>
      {previews.map((c) => (
        <Pressable key={c.comment_id} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Commentaire de ${c.author.display_name} : ${c.body}`}>
          <Text variant="callout" color={dark.textStrong} numberOfLines={2} style={{ lineHeight: 20 }}>
            <Text variant="callout" weight="700" tone="fog">
              {c.author.display_name}
            </Text>
            {c.by_post_author ? (
              <Text variant="caption" weight="700" tone="mint">
                {' '}· Auteur
              </Text>
            ) : null}{' '}
            {c.body}
          </Text>
        </Pressable>
      ))}
      {more > 0 ? (
        <Pressable onPress={onOpen} accessibilityRole="button" hitSlop={4}>
          <Text variant="callout" tone="fogSecondary" style={{ fontSize: 13 }}>
            {previews.length === 0
              ? `Voir ${post.comment_count === 1 ? 'le commentaire' : `les ${post.comment_count} commentaires`}`
              : `Voir ${more === 1 ? 'l’autre commentaire' : `les ${more} autres commentaires`}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: { backgroundColor: dark.background, paddingVertical: 20 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.xs, paddingBottom: spacing.md },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: 44 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  quote: {
    marginHorizontal: spacing.lg,
    padding: 20,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: dark.goldLine,
    backgroundColor: dark.surface,
    overflow: 'hidden',
    gap: spacing.lg,
  },
  quoteText: { fontSize: 22, lineHeight: 30 },
  quoteActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bodyAbove: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  cta: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  ctaGold: { backgroundColor: dark.gold },
  ctaMint: { backgroundColor: dark.mint },
  ctaOutline: { borderWidth: 1, borderColor: dark.borderStrong },
  ctaBelow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  productChip: {
    position: 'absolute',
    left: spacing.lg,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 6,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: dark.glass,
    borderWidth: 1,
    borderColor: dark.glassBorder,
  },
  productChipThumb: { width: 44, height: 44, borderRadius: 12 },
  productChipBottom: { bottom: spacing.lg },
  // With a narration bar at the bottom, the article chip moves to the top-left corner.
  productChipTop: { top: spacing.lg },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  productRowThumb: { width: 52, height: 52, borderRadius: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  iconAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowAction: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill },
  previews: { gap: 6, paddingHorizontal: spacing.lg, paddingTop: 4 },
});
