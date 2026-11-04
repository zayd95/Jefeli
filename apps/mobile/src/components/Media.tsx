import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, Volume2, VolumeX } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { colors, dark, Text } from '@/design';
import { useMediaUrl, type Bucket } from '@/lib/media';
import type { MediaRow } from '@/lib/types';
import { fill } from '@/design/fill';

/** Poster-first video: nothing is downloaded until the member taps play (data-friendly). */
export function VideoPlayerInline({ uri, posterUri, autoPlay, loop = true }: { uri: string; posterUri?: string | null; autoPlay?: boolean; loop?: boolean }) {
  const [started, setStarted] = useState(!!autoPlay);
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(started ? uri : null, (p) => {
    p.loop = loop;
    p.muted = true;
    if (started) p.play();
  });

  if (!started) {
    return (
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setStarted(true)} accessibilityRole="button" accessibilityLabel="Lire la vidéo">
        {posterUri ? <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} />}
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
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
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

export function MediaItem({ media, bucket, width, height, tone = 'light' }: { media: MediaRow; bucket: Bucket; width: number; height: number; tone?: 'light' | 'dark' }) {
  const uri = useMediaUrl(bucket, media.storage_path);
  const poster = useMediaUrl(bucket, media.poster_path);
  return (
    <View style={{ width, height, backgroundColor: tone === 'dark' ? dark.surface : colors.surfaceMuted }}>
      {media.kind === 'video' ? (
        uri ? <VideoPlayerInline uri={uri} posterUri={poster} /> : null
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
}: {
  media: MediaRow[];
  bucket: Bucket;
  width?: number;
  height?: number;
  tone?: 'light' | 'dark';
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = fixedWidth ?? Math.min(screenWidth, 640);
  const height = fixedHeight ?? mediaHeight(media[0], width);
  const [index, setIndex] = useState(0);
  if (media.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={{ width, height }}>
      {media.length === 1 ? (
        <MediaItem media={media[0] as MediaRow} bucket={bucket} width={width} height={height} tone={tone} />
      ) : (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={64}>
          {media.map((m) => (
            <MediaItem key={m.id} media={m} bucket={bucket} width={width} height={height} tone={tone} />
          ))}
        </ScrollView>
      )}
      {media.length > 1 ? (
        <>
          <View style={styles.counter}>
            <Text variant="micro" weight="700" color={colors.white}>
              {index + 1}/{media.length}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {media.map((m, i) => (
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
  const path = media ? (media.kind === 'video' ? (media.poster_path ?? null) : media.storage_path) : null;
  const uri = useMediaUrl(bucket, path);
  return (
    <View style={[{ backgroundColor: colors.surfaceMuted, overflow: 'hidden' }, style]} accessibilityLabel={label} accessibilityRole="image">
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} /> : null}
      {media?.kind === 'video' ? (
        <View style={styles.videoTag}>
          <Play size={11} color={colors.white} fill={colors.white} />
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
  videoTag: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(16,37,44,0.6)', alignItems: 'center', justifyContent: 'center' },
});
