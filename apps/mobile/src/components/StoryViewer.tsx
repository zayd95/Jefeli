import { formatListingPrice, timeAgo, timeLeft, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Bookmark, Eye, Flag, Heart, MoreHorizontal, Send, ShoppingBag, Trash2, Volume2, VolumeX, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, colors, Field, fonts, IconButton, Sheet, SheetAction, spacing, Text, useToast } from '@/design';
import { fetchProduct } from '@/lib/api/products';
import { addToHighlight, deleteStory, fetchStoryViewers, likeStory, markStoryViewed, replyToStory } from '@/lib/api/stories';
import { useAuth } from '@/lib/auth';
import { useMediaUrl } from '@/lib/media';
import type { ProfileLite, StoryRow } from '@/lib/types';

import { Thumb } from './Media';
import { goBack } from '@/lib/nav';

const IMAGE_MS = 5500;

export function StoryViewer({ stories, author, isHighlight }: { stories: StoryRow[]; author: ProfileLite | null; isHighlight?: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [highlightSheet, setHighlightSheet] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState('Nouveautés');
  const story = stories[index];
  const isOwner = story?.author_id === userId;
  const startedAt = useRef(0);
  const elapsedBefore = useRef(0);

  const close = useCallback(() => goBack(), []);
  const next = useCallback(() => {
    if (index < stories.length - 1) {
      setProgress(0);
      setIndex((i) => i + 1);
    } else close();
  }, [index, stories.length, close]);
  const prev = () => {
    setProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  };

  const duration = story?.media_kind === 'video' ? Math.min(60_000, Math.max(3000, story.duration_ms ?? 15_000)) : IMAGE_MS;

  useEffect(() => {
    elapsedBefore.current = 0;
    startedAt.current = Date.now();
    if (story && userId && !isOwner) markStoryViewed(userId, story.id).then(() => qc.invalidateQueries({ queryKey: ['story-rail'] })).catch(() => {});
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const typing = reply.length > 0;
  useEffect(() => {
    if (paused || typing || menu || viewers || highlightSheet) {
      elapsedBefore.current += Date.now() - startedAt.current;
      return;
    }
    startedAt.current = Date.now();
    const t = setInterval(() => {
      const p = (elapsedBefore.current + Date.now() - startedAt.current) / duration;
      if (p >= 1) {
        clearInterval(t);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
  }, [paused, typing, menu, viewers, highlightSheet, duration, next]);

  const mediaUri = useMediaUrl('private-media', story?.storage_path);
  const posterUri = useMediaUrl('private-media', story?.poster_path);
  const product = useQuery({ queryKey: ['product', story?.product_id], queryFn: () => fetchProduct(story?.product_id as string), enabled: !!story?.product_id });
  const viewerList = useQuery({ queryKey: ['story-viewers', story?.id], queryFn: () => fetchStoryViewers(story?.id as string), enabled: viewers && isOwner });

  if (!story) return null;

  async function sendReply() {
    const body = reply.trim();
    if (!body || !story) return;
    try {
      const cid = await replyToStory(story.id, body);
      setReply('');
      toast('Réponse envoyée en message privé', 'success');
      router.replace(`/chat/${cid}`);
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  async function toggleLike() {
    if (!story || !userId) return;
    const nextLiked = !liked[story.id];
    setLiked((l) => ({ ...l, [story.id]: nextLiked }));
    await likeStory(userId, story.id, nextLiked).catch((e) => toast(toFrenchError(e), 'error'));
  }

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {story.media_kind === 'video' ? (
          mediaUri ? <StoryVideo uri={mediaUri} muted={muted} paused={paused || typing} /> : null
        ) : mediaUri ? (
          <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" placeholder={posterUri ? { uri: posterUri } : undefined} />
        ) : null}
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.shadeTop} pointerEvents="none" />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} style={styles.shadeBottom} pointerEvents="none" />
      </View>

      <View style={styles.tapZones}>
        <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Statut précédent" />
        <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Statut suivant" />
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {stories.map((s, i) => (
            <View key={s.id} style={styles.bar}>
              <View style={[styles.barFill, { width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }]} />
            </View>
          ))}
        </View>
        <View style={styles.head}>
          <Pressable style={styles.author} onPress={() => author && router.push(`/u/${author.handle}`)} accessibilityRole="button">
            <Avatar path={author?.avatar_path} name={author?.display_name ?? '?'} size={36} />
            <View>
              <Text variant="callout" weight="700" color={colors.white}>
                {author?.display_name}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.8)">
                {isHighlight ? timeAgo(story.created_at) : `${timeAgo(story.created_at)} · reste ${timeLeft(story.expires_at)}`}
              </Text>
            </View>
          </Pressable>
          {story.media_kind === 'video' ? (
            <IconButton icon={muted ? VolumeX : Volume2} label={muted ? 'Activer le son' : 'Couper le son'} color={colors.white} onPress={() => setMuted((m) => !m)} />
          ) : null}
          <IconButton icon={MoreHorizontal} label="Options" color={colors.white} onPress={() => setMenu(true)} />
          <IconButton icon={X} label="Fermer" color={colors.white} onPress={close} />
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {story.caption ? (
          <Text variant="headline" weight="600" color={colors.white} align="center" style={styles.caption} pointerEvents="none">
            {story.caption}
          </Text>
        ) : null}

        {product.data ? (
          <Pressable style={styles.sticker} onPress={() => router.push(`/p/${product.data!.id}`)} accessibilityRole="button" accessibilityLabel={`Voir l’article ${product.data.title}`}>
            <Thumb media={product.data.media[0]} style={{ width: 52, height: 52, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="700" numberOfLines={1}>
                {product.data.title}
              </Text>
              <Text variant="callout" weight="800">
                {formatListingPrice(product.data)}
              </Text>
            </View>
            <View style={styles.stickerCta}>
              <ShoppingBag size={16} color={colors.ink} />
              <Text variant="caption" weight="800">
                Voir
              </Text>
            </View>
          </Pressable>
        ) : null}

        {isOwner ? (
          <View style={styles.ownerBar}>
            <Pressable style={styles.ownerBtn} onPress={() => setViewers(true)} accessibilityRole="button">
              <Eye size={20} color={colors.white} />
              <Text variant="callout" weight="600" color={colors.white}>
                Vues
              </Text>
            </Pressable>
            {!isHighlight ? (
              <Pressable style={styles.ownerBtn} onPress={() => setHighlightSheet(true)} accessibilityRole="button">
                <Bookmark size={20} color={colors.white} />
                <Text variant="callout" weight="600" color={colors.white}>
                  Garder sur mon profil
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.replyBar}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder={`Répondre à ${author?.display_name ?? ''}…`}
                placeholderTextColor="rgba(255,255,255,0.75)"
                style={styles.replyInput}
                maxLength={1000}
                onSubmitEditing={sendReply}
                returnKeyType="send"
                accessibilityLabel="Répondre en message privé"
              />
              {reply.trim() ? (
                <IconButton icon={Send} label="Envoyer la réponse" color={colors.white} onPress={sendReply} />
              ) : (
                <IconButton icon={Heart} label="J’aime ce statut" color={liked[story.id] ? colors.danger : colors.white} filled={liked[story.id]} fillColor={colors.danger} onPress={toggleLike} />
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        {isOwner ? (
          <SheetAction
            icon={Trash2}
            label="Supprimer ce statut"
            destructive
            onPress={async () => {
              setMenu(false);
              try {
                await deleteStory(story.id);
                qc.invalidateQueries({ queryKey: ['story-rail'] });
                qc.invalidateQueries({ queryKey: ['active-stories'] });
                close();
              } catch (e) {
                toast(toFrenchError(e), 'error');
              }
            }}
          />
        ) : (
          <SheetAction
            icon={Flag}
            label="Signaler ce statut"
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/report', params: { type: 'story', id: story.id } });
            }}
          />
        )}
      </Sheet>

      <Sheet visible={viewers} onClose={() => setViewers(false)} title="Vu par" scroll>
        {(viewerList.data ?? []).length === 0 ? (
          <Text tone="secondary">{viewerList.isPending ? 'Chargement…' : 'Personne pour l’instant.'}</Text>
        ) : (
          (viewerList.data ?? []).map((v) =>
            v.viewer ? (
              <View key={v.viewer.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 }}>
                <Avatar path={v.viewer.avatar_path} name={v.viewer.display_name} size={36} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {v.viewer.display_name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {timeAgo(v.viewed_at)}
                </Text>
              </View>
            ) : null,
          )
        )}
      </Sheet>

      <Sheet visible={highlightSheet} onClose={() => setHighlightSheet(false)} title="Garder sur mon profil">
        <View style={{ gap: spacing.md }}>
          <Text variant="callout" tone="secondary">
            Il restera sur votre profil, visible par le même public.
          </Text>
          <Field label="Nom de la sélection" value={highlightTitle} onChangeText={setHighlightTitle} maxLength={30} />
          <Button
            label="Ajouter"
            variant="cta"
            disabled={!highlightTitle.trim()}
            onPress={async () => {
              setHighlightSheet(false);
              try {
                await addToHighlight(userId ?? '', story.id, highlightTitle.trim());
                qc.invalidateQueries({ queryKey: ['highlights', userId] });
                toast('Ajouté à votre profil', 'success');
              } catch (e) {
                toast(toFrenchError(e), 'error');
              }
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function StoryVideo({ uri, muted, paused }: { uri: string; muted: boolean; paused: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    // expo-video's documented API mutates the player instance.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 280 },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  overlay: { flex: 1 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, paddingTop: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  caption: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  sticker: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.surface },
  stickerCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.action, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  replyInput: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: spacing.lg, color: colors.white, fontFamily: fonts.medium, fontSize: 15, backgroundColor: 'rgba(0,0,0,0.25)' },
  ownerBar: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingBottom: spacing.md },
  ownerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.35)' },
});
