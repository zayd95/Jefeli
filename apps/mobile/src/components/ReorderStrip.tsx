/**
 * The editor's gallery (W1.3): drag a thumbnail to reorder; the first one is the cover. Dragging is
 * never the only way: tapping a thumbnail selects it and shows « ← Déplacer », « Déplacer → » and
 * « Retirer » buttons (WCAG 2.5.7), also offered to screen readers as actions. Under each photo,
 * the time at which the narration shows it (« visite guidée »).
 */
import { ArrowLeft, ArrowRight, Play, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { colors, dark, IconButton, spacing, Text } from '@/design';

const SIZE = 60;
const GAP = 10;
const ROW = SIZE + 22; // thumbnail + cue label

export interface StripItem {
  key: string;
  uri: string | null;
  kind: string;
  /** « 0:12 »: when the narration shows this photo. */
  cue?: string | null;
}

export function ReorderStrip({
  items,
  selected,
  onSelect,
  onMove,
  onRemove,
  onAdd,
  max = 10,
  tone = 'dark',
}: {
  items: StripItem[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  max?: number;
  tone?: 'light' | 'dark';
}) {
  const [width, setWidth] = useState(0);
  const light = tone === 'light';
  const fg = light ? colors.ink : dark.text;
  const perRow = Math.max(1, Math.floor((width + GAP) / (SIZE + GAP)));
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} testID="reorder-strip">
        {items.map((it, i) => (
          <DraggableThumb
            key={it.key}
            item={it}
            index={i}
            count={items.length}
            perRow={perRow}
            selected={selected === i}
            light={light}
            onSelect={() => onSelect(selected === i ? null : i)}
            onMove={onMove}
            onRemove={() => onRemove(i)}
          />
        ))}
        {items.length < max ? (
          <Pressable onPress={onAdd} style={({ pressed }) => [styles.add, light && { borderColor: colors.borderStrong }, pressed && { backgroundColor: light ? colors.surfaceSubtle : dark.subtle }]} accessibilityRole="button" accessibilityLabel="Ajouter des photos">
            <Plus size={22} color={fg} />
          </Pressable>
        ) : null}
      </View>
      {selected !== null && items[selected] ? (
        <View style={[styles.selectedBar, light && { backgroundColor: colors.surfaceSubtle }]} accessibilityLiveRegion="polite">
          <Text variant="caption" weight="700" tone={light ? 'default' : 'fog'} style={{ flex: 1 }}>
            {selected === 0 ? 'Couverture · glissez ou déplacez' : `Photo ${selected + 1} · glissez ou déplacez`}
          </Text>
          <IconButton icon={ArrowLeft} label="Déplacer à gauche" color={fg} disabled={selected === 0} onPress={() => (onMove(selected, selected - 1), onSelect(selected - 1))} />
          <IconButton icon={ArrowRight} label="Déplacer à droite" color={fg} disabled={selected === items.length - 1} onPress={() => (onMove(selected, selected + 1), onSelect(selected + 1))} />
          <IconButton icon={Trash2} label="Retirer" color={fg} onPress={() => (onRemove(selected), onSelect(null))} />
        </View>
      ) : null}
    </View>
  );
}

function DraggableThumb({
  item,
  index,
  count,
  perRow,
  selected,
  light,
  onSelect,
  onMove,
  onRemove,
}: {
  light?: boolean;
  item: StripItem;
  index: number;
  count: number;
  perRow: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const latest = useRef({ index, count, perRow, onMove });
  useEffect(() => {
    latest.current = { index, count, perRow, onMove };
  });
  // The handlers read `latest` only while a finger or the mouse moves, never during render; one
  // PanResponder per thumbnail keeps its gesture state for the whole drag.
  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the handlers read the ref on gesture events only
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderGrant: () => setOffset({ x: 0, y: 0 }),
        onPanResponderMove: (_, g) => setOffset({ x: g.dx, y: g.dy }),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          const { index: from, count: n, perRow: cols, onMove: move } = latest.current;
          const to = Math.max(0, Math.min(n - 1, from + Math.round(g.dx / (SIZE + GAP)) + Math.round(g.dy / (ROW + GAP)) * cols));
          setOffset(null);
          if (to !== from) move(from, to);
        },
        onPanResponderTerminate: () => setOffset(null),
      }),
    [],
  );
  const label = `${index === 0 ? 'Couverture' : `Photo ${index + 1}`}${item.kind === 'video' ? ' (vidéo)' : ''}${item.cue ? `, montrée à ${item.cue}` : ''}`;
  return (
    <View
      {...pan.panHandlers}
      style={[styles.cell, offset && { transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale: 1.06 }], zIndex: 10, opacity: 0.92 }]}
      testID={`thumb-${index}`}
    >
      <Pressable
        onPress={onSelect}
        style={[styles.thumb, light && { backgroundColor: colors.surfaceMuted }, selected && (light ? { borderColor: colors.ink } : styles.thumbOn)]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Faites glisser pour changer l’ordre, ou touchez pour déplacer avec des boutons"
        accessibilityState={{ selected }}
        accessibilityActions={[
          { name: 'moveLeft', label: 'Déplacer à gauche' },
          { name: 'moveRight', label: 'Déplacer à droite' },
          { name: 'remove', label: 'Retirer' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'moveLeft' && index > 0) onMove(index, index - 1);
          if (e.nativeEvent.actionName === 'moveRight' && index < count - 1) onMove(index, index + 1);
          if (e.nativeEvent.actionName === 'remove') onRemove();
        }}
      >
        {item.uri ? <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} />}
        {item.kind === 'video' ? (
          <View style={styles.video}>
            <Play size={12} color={colors.white} fill={colors.white} />
          </View>
        ) : null}
        {index === 0 ? <View style={styles.coverMark} /> : null}
      </Pressable>
      <Text variant="micro" weight="700" color={light ? colors.accentDeep : dark.mint} style={{ fontSize: 10, height: 14 }} accessibilityElementsHidden importantForAccessibility="no">
        {item.cue ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, rowGap: GAP },
  cell: { width: SIZE, height: ROW, alignItems: 'center', gap: 4 },
  thumb: { width: SIZE, height: SIZE, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: dark.surface },
  thumbOn: { borderColor: colors.mint },
  coverMark: { position: 'absolute', left: 6, right: 6, bottom: 5, height: 3, borderRadius: 2, backgroundColor: colors.mint },
  video: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  add: { width: SIZE, height: SIZE, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: dark.borderStrong, alignItems: 'center', justifyContent: 'center' },
  selectedBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 14, backgroundColor: dark.surface },
});
