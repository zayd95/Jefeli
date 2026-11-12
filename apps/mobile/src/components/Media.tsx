import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from 'expo-video';
import { Mic, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react-native';
import { createContext, useContext, useEffect, useId, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, dark, Text, videoFill } from '@/design';
import { useMediaUrl, type Bucket } from '@/lib/media';
import { getPlaying, pauseAll, setPlaying, useIsPlaying } from '@/lib/playback';
import type { MediaRow } from '@/lib/types';
import { fill } from '@/design/fill';

// ---------------------------------------------------------------------------
// Playback rules (W1.1, shared with audio in W1.2 via @/lib/playback): one audible source plays at
// a time, everything pauses when the app goes to the background or the browser tab is hidden, and
// the feed autoplays only its most visible video, muted, unless the member asked to save data or
// reduce motion.
// ---------------------------------------------------------------------------

function webAutoplayAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** May a feed video start by itself (muted)? No on data saving, 2G or reduced motion. */
function useAutoplayAllowed(): boolean {
  const [allowed, setAllowed] = useState(() => (Platform.OS === 'web' ? webAutoplayAllowed() : true));
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => alive && setAllowed(!reduce));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => setAllowed(!reduce));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return allowed;
}

/** Pause whatever is playing (e.g. when the feed screen loses focus). */
export function pauseAllVideos() {
  pauseAll();
}

/** The feed tells its cards which post is the most visible one (FlatList viewability). */
export const ActivePostContext = createContext<string | null | undefined>(undefined);
export function useIsActivePost(postId: string): boolean | undefined {
  const active = useContext(ActivePostContext);
  return active === undefined ? undefined : active === postId;
}

/**
 * Poster first. Outside the feed (`active` undefined) nothing is downloaded until the member taps
 * play. In the feed, the most visible card's video starts muted when autoplay is allowed, and
 * pauses as soon as the card is no longer the most visible one.
 */
export function VideoPlayerInline({
  uri,
  posterUri,
  active,
  loop = true,
}: {
  uri: string;
  posterUri?: string | null;
  active?: boolean;
  loop?: boolean;
}) {
  const key = useId();
  const autoplayAllowed = useAutoplayAllowed();
  const playing = useIsPlaying(key);
  const [tapped, setTapped] = useState(false);
  // Loaded when the member tapped play, or while this is the feed's active card and autoplay is
  // allowed. An autoplayed video that leaves the screen releases its source (memory, data).
  const started = tapped || (active === true && autoplayAllowed);
  const [muted, setMuted] = useState(true);
  const [status, setStatus] = useState<VideoPlayerStatus>('idle');
  const player = useVideoPlayer(started ? uri : null, (p) => {
    p.loop = loop;
    p.muted = true;
  });
  useEventListener(player, 'statusChange', ({ status: next }) => setStatus(next));

  // Autoplay in the feed: the active card claims playback; a card that stops being active pauses.
  useEffect(() => {
    if (active && autoplayAllowed) {
      setPlaying(key);
    } else if (active === false && getPlaying() === key) {
      setPlaying(null);
    }
  }, [active, autoplayAllowed, key]);
  useEffect(() => {
    if (!started) return;
    if (playing) player.play();
    else player.pause();
  }, [playing, started, player]);
  useEffect(() => () => {
    if (getPlaying() === key) setPlaying(null);
  }, [key]);

  const start = () => {
    setTapped(true);
    setPlaying(key);
  };

  if (!started) {
    return (
      <Pressable style={StyleSheet.absoluteFill} onPress={start} accessibilityRole="button" accessibilityLabel="Lire la vidéo">
        {posterUri ? <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.night }]} />}
        <View style={styles.playWrap}>
          <View style={styles.play}>
            <Play size={24} color={dark.text} fill={dark.text} />
          </View>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={videoFill} contentFit="cover" nativeControls={false} />
      {status !== 'readyToPlay' && posterUri ? <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => (status === 'error' ? player.replace(uri) : playing ? setPlaying(null) : setPlaying(key))}
        accessibilityRole="button"
        accessibilityLabel={status === 'error' ? 'Réessayer la lecture' : playing ? 'Mettre en pause' : 'Lire la vidéo'}
      >
        {status === 'error' ? (
          <View style={styles.playWrap}>
            <View style={styles.errorPill}>
              <RotateCcw size={16} color={colors.white} />
              <Text variant="caption" weight="600" color={colors.white}>
                Lecture impossible · Réessayer
              </Text>
            </View>
          </View>
        ) : status === 'loading' && playing ? (
          <View style={styles.playWrap}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : !playing ? (
          <View style={styles.playWrap}>
            <View style={styles.play}>
              <Play size={24} color={dark.text} fill={dark.text} />
            </View>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        style={styles.mute}
        onPress={() => {
          // expo-video's documented API mutates the player instance.
          // eslint-disable-next-line react-hooks/immutability
          player.muted = !muted;
          setMuted(!muted);
        }}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
      >
        {muted ? <VolumeX size={18} color={colors.white} /> : <Volume2 size={18} color={colors.white} />}
      </Pressable>
    </View>
  );
}

export function MediaItem({
  media,
  bucket,
  width,
  height,
  tone = 'light',
  active,
}: {
  media: MediaRow;
  bucket: Bucket;
  width: number;
  height: number;
  tone?: 'light' | 'dark';
  /** Feed only: this slide is the one on screen in the most visible card. */
  active?: boolean;
}) {
  const remote = useMediaUrl(bucket, media.local_uri ? null : media.storage_path);
  const remotePoster = useMediaUrl(bucket, media.local_uri ? null : media.poster_path);
  const uri = media.local_uri ?? remote;
  const poster = media.local_uri ? (media.local_poster ?? null) : remotePoster;
  return (
    <View style={{ width, height, backgroundColor: tone === 'dark' ? dark.surface : colors.surfaceMuted }}>
      {media.kind === 'video' ? (
        uri ? <VideoPlayerInline uri={uri} posterUri={poster} active={active} /> : null
      ) : uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          recyclingKey={uri}
          accessibilityLabel="Photo"
          placeholder={{ blurhash: 'L8Q9%x~q00D%9Fxu%MRj00Rj%Mt7' }}
        />
      ) : null}
    </View>
  );
}

/** Aspect ratio clamped between 4:5 (portrait) and 1.91:1 (landscape), like most social apps. */
export function mediaHeight(media: MediaRow | undefined, width: number): number {
  if (!media?.width || !media?.height) return width;
  const ratio = media.height / media.width;
  return Math.round(width * Math.min(1.25, Math.max(0.52, ratio)));
}

export function MediaCarousel({
  media,
  bucket,
  width: fixedWidth,
  height: fixedHeight,
  tone = 'light',
  active,
  index: followIndex,
  onUserSwipe,
}: {
  media: MediaRow[];
  bucket: Bucket;
  width?: number;
  height?: number;
  tone?: 'light' | 'dark';
  /** Feed only: whether this carousel's card is the most visible one. */
  active?: boolean;
  /** « Visite guidée »: the photo the narration is talking about (followed until the member swipes). */
  index?: number;
  onUserSwipe?: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  // Voice rows are played by the card (narration bar or voice card), never shown as a slide.
  const visual = media.filter((m) => m.kind !== 'audio');
  const width = fixedWidth ?? Math.min(screenWidth, 640);
  const height = fixedHeight ?? mediaHeight(visual[0], width);
  const [userIndex, setUserIndex] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const programmatic = useRef<number | null>(null);
  const index = followIndex ?? userIndex;

  useEffect(() => {
    if (followIndex == null) return;
    programmatic.current = followIndex;
    scroller.current?.scrollTo({ x: followIndex * width, animated: true });
  }, [followIndex, width]);

  if (visual.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (programmatic.current !== null) {
      if (i === programmatic.current) programmatic.current = null;
      return;
    }
    if (i !== index) {
      setUserIndex(i);
      onUserSwipe?.();
    }
  };

  return (
    <View style={{ width, height }}>
      {visual.length === 1 ? (
        <MediaItem media={visual[0] as MediaRow} bucket={bucket} width={width} height={height} tone={tone} active={active} />
      ) : (
        <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={64}>
          {visual.map((m, i) => (
            <MediaItem key={m.id} media={m} bucket={bucket} width={width} height={height} tone={tone} active={active === undefined ? undefined : active && i === index} />
          ))}
        </ScrollView>
      )}
      {visual.length > 1 ? (
        <>
          <View style={styles.counter} accessibilityLabel={`Photo ${index + 1} sur ${visual.length}`}>
            <Text variant="micro" weight="700" color={colors.white}>
              {index + 1}/{visual.length}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {visual.map((m, i) => (
              <View key={m.id} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Thumbnail for listings (first image, or a video's poster). */
export function Thumb({ media, bucket = 'public-media', style, label }: { media?: Pick<MediaRow, 'storage_path' | 'kind' | 'poster_path'> | null; bucket?: Bucket; style?: object; label?: string }) {
  const path = media ? (media.kind === 'video' ? (media.poster_path ?? null) : media.kind === 'audio' ? null : media.storage_path) : null;
  const uri = useMediaUrl(bucket, path);
  return (
    <View style={[{ backgroundColor: colors.surfaceMuted, overflow: 'hidden' }, style]} accessibilityLabel={label} accessibilityRole="image">
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} /> : null}
      {media?.kind === 'video' ? (
        <View style={styles.videoTag}>
          <Play size={11} color={colors.white} fill={colors.white} />
        </View>
      ) : media?.kind === 'audio' ? (
        <View style={styles.audioTile}>
          <Mic size={20} color={dark.mint} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  playWrap: { ...fill, alignItems: 'center', justifyContent: 'center' },
  // Lovable `.lab-glass` play control
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  mute: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 12, right: 12, backgroundColor: dark.glass, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: colors.white, width: 16 },
  errorPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: dark.glass },
  audioTile: { ...fill, backgroundColor: dark.surface, alignItems: 'center', justifyContent: 'center' },
  videoTag: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(16,37,44,0.6)', alignItems: 'center', justifyContent: 'center' },
});
