/**
 * The media of a publication: photos or a video, the narration over them with its « visite guidée »
 * (the gallery follows the voice until the member swipes), and the linked article as a glass chip.
 *
 * One component for the feed card and for the editor's preview (W1.3): what the seller sees while
 * composing is what buyers get — same voice control, same photo navigation, same article chip.
 * In the editor the rows carry `local_uri` (files not uploaded yet) instead of storage paths.
 */
import { formatListingPrice } from '@jefeli/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dark, spacing, Text } from '@/design';
import type { Bucket } from '@/lib/media';
import type { MediaRow, TaggedProduct } from '@/lib/types';

import { NarrationBar } from './audio/Voice';
import { MediaCarousel, Thumb } from './Media';
import { PriceLabel } from './PriceLabel';

export type Cue = { t: number; i: number };

/** « Visite guidée » cues (validated by the database, or by the recorder), sorted by time. */
export function parseCues(raw: unknown): Cue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Cue => typeof c === 'object' && c !== null && typeof (c as Cue).t === 'number' && typeof (c as Cue).i === 'number')
    .sort((a, b) => a.t - b.t);
}

export function photoAt(cues: Cue[], ms: number): number {
  let i = cues[0]?.i ?? 0;
  for (const c of cues) if (c.t <= ms) i = c.i;
  return i;
}

export interface MediaVoice {
  uri: string | null;
  durationMs: number | null;
  waveform?: number[] | null;
  language?: string | null;
  cues?: unknown;
}

export function PostMedia({
  visual,
  voice,
  product,
  bucket,
  width,
  height,
  active,
  onOpen,
}: {
  visual: MediaRow[];
  voice: MediaVoice | null;
  product?: TaggedProduct | null;
  bucket: Bucket;
  width: number;
  height?: number;
  /** Feed only: this card is the most visible one. */
  active?: boolean;
  /** Feed only: a tap on a photo opens the publication. */
  onOpen?: () => void;
}) {
  const cues = useMemo(() => parseCues(voice?.cues), [voice?.cues]);
  // The gallery follows the narration until the member swipes it themselves.
  const [following, setFollowing] = useState(true);
  const [cuePhoto, setCuePhoto] = useState<number | undefined>(undefined);
  const onNarration = (ms: number, playing: boolean) => {
    if (cues.length < 2) return;
    if (playing && ms < 300 && !following) setFollowing(true);
    if (!playing && ms === 0) return;
    const i = photoAt(cues, ms);
    if (i !== cuePhoto) setCuePhoto(i);
  };

  const carousel = (
    <MediaCarousel
      media={visual}
      bucket={bucket}
      width={width}
      height={height}
      tone="dark"
      active={active}
      index={voice && following ? cuePhoto : undefined}
      onUserSwipe={() => setFollowing(false)}
    />
  );

  return (
    <View testID="post-media">
      {visual[0]?.kind === 'video' || !onOpen ? (
        // A video handles its own taps (play, pause, sound): no wrapper around it, which screen
        // readers would announce as « dimmed » for the play button too.
        carousel
      ) : (
        <Pressable onPress={onOpen} accessibilityLabel="Ouvrir la publication">
          {carousel}
        </Pressable>
      )}
      {voice ? <NarrationBar uri={voice.uri} durationMs={voice.durationMs} waveform={voice.waveform} language={voice.language} active={active} onPosition={onNarration} /> : null}
      {product ? (
        <Pressable
          onPress={() => router.push(`/p/${product.id}`)}
          style={({ pressed }) => [styles.productChip, voice ? styles.productChipTop : styles.productChipBottom, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`Voir l’article ${product.title}, ${formatListingPrice(product)}`}
        >
          <Thumb media={[...product.media].sort((a, b) => a.position - b.position)[0]} style={styles.productChipThumb} />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text variant="caption" weight="600" tone="fog" numberOfLines={1} style={{ fontSize: 13 }}>
              {product.title}
            </Text>
            {product.status === 'sold' || product.status === 'reserved' ? (
              <Text variant="caption" weight="700" tone="gold">
                {product.status === 'sold' ? 'Vendu' : 'Réservé'}
              </Text>
            ) : (
              <PriceLabel product={product} size="card" compact tone="dark" style={{ fontSize: 13, lineHeight: 17 }} />
            )}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
