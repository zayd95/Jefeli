import { Image } from 'expo-image';
import { Camera, ImagePlus, Play, X } from 'lucide-react-native';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, colors, ProgressBar, radius, spacing, Text, useToast } from '@/design';
import { pickMedia, uploadErrorMessage, type LocalMedia } from '@/lib/upload';

export function MediaPickerStrip({
  media,
  onChange,
  max = 10,
  allowVideo = true,
  label = 'Photos et vidéos',
  required,
}: {
  media: LocalMedia[];
  onChange: (m: LocalMedia[]) => void;
  max?: number;
  allowVideo?: boolean;
  label?: string;
  required?: boolean;
}) {
  const toast = useToast();
  async function add(camera: boolean) {
    try {
      const picked = await pickMedia({ allowVideo, multiple: !camera, limit: max - media.length, camera });
      if (picked?.length) onChange([...media, ...picked].slice(0, max));
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
          {label}
          <Text variant="callout" tone="secondary" weight="400" style={{ fontSize: 13 }}>
            {required ? ' · obligatoire' : ' · facultatif'}
          </Text>
        </Text>
        <Text variant="caption" tone="tertiary">
          {media.length}/{max}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {media.length < max ? (
          <>
            <Pressable onPress={() => add(false)} style={styles.add} accessibilityRole="button" accessibilityLabel="Ajouter depuis la galerie">
              <ImagePlus size={24} color={colors.ink} />
              <Text variant="caption" weight="600">
                Galerie
              </Text>
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Pressable onPress={() => add(true)} style={styles.add} accessibilityRole="button" accessibilityLabel="Prendre une photo ou une vidéo">
                <Camera size={24} color={colors.ink} />
                <Text variant="caption" weight="600">
                  Caméra
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {media.map((m, i) => (
          <View key={`${m.uri}-${i}`} style={styles.thumb}>
            {m.kind === 'image' ? (
              <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.video]}>
                <Play size={22} color={colors.white} fill={colors.white} />
                {m.durationMs ? (
                  <Text variant="micro" color={colors.white} weight="700">
                    {Math.round(m.durationMs / 1000)} s
                  </Text>
                ) : null}
              </View>
            )}
            {i === 0 ? (
              <View style={styles.cover}>
                <Text variant="micro" weight="700" color={colors.white}>
                  Couverture
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => onChange(media.filter((_, j) => j !== i))}
              style={styles.remove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retirer ce média"
            >
              <X size={14} color={colors.white} strokeWidth={3} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function UploadOverlay({ visible, progress, label, onCancel }: { visible: boolean; progress: number; label: string; onCancel: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box} accessibilityLiveRegion="polite">
          <Text variant="headline">{label}</Text>
          <ProgressBar value={progress} />
          <Text variant="caption" tone="secondary">
            {Math.round(progress * 100)} % — gardez l’application ouverte. En cas de coupure, nous réessayons automatiquement.
          </Text>
          <Button label="Annuler l’envoi" variant="outline" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function OptionRow<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
}: {
  options: { key: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  // Light rows without hints are a soft segmented control (owner's UI reference); rows with
  // hints, and the dark variant used over media, keep separate boxes.
  const segmented = !dark && options.every((o) => !o.hint);
  return (
    <View style={segmented ? styles.segment : styles.optionRow}>
      {options.map((o) => {
        const on = o.key === value;
        const fg = dark ? (on ? colors.ink : colors.white) : on ? colors.white : colors.ink;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={
              segmented
                ? [styles.segmentItem, on && styles.segmentOn]
                : [styles.option, on && styles.optionOn, dark && styles.optionDark, dark && on && styles.optionDarkOn]
            }
            accessibilityRole="radio"
            accessibilityState={{ selected: on }} aria-checked={on}
            accessibilityLabel={o.label}
          >
            <Text variant="callout" weight={segmented && !on ? '500' : '700'} color={segmented && !on ? colors.textSecondary : fg} align="center" numberOfLines={2} style={segmented ? { fontSize: 13.5, lineHeight: 17 } : undefined}>
              {o.label}
            </Text>
            {o.hint ? (
              <Text variant="micro" weight="500" color={dark ? fg : on ? colors.mintSoft : colors.textSecondary} align="center">
                {o.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Lovable choice pills (`Pill`): rounded-full, the selected one in Atlantic night with fog text,
 * the others white with a hairline and slate text. Radio semantics for screen readers.
 */
export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: { key: T; label: string; a11y?: string }[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <View style={[styles.pills, !wrap && { flexWrap: 'nowrap' }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            accessibilityLabel={o.a11y ?? o.label}
          >
            <Text weight="600" color={on ? colors.surface : colors.textSecondary} style={{ fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.night, borderColor: colors.night },
  add: {
    width: 84,
    height: 84,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumb: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  video: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cover: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,37,44,0.65)', paddingVertical: 2, alignItems: 'center' },
  remove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(16,37,44,0.75)', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, minHeight: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  segmentOn: { backgroundColor: colors.ink },
  option: { flex: 1, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' },
  optionDarkOn: { backgroundColor: colors.action, borderColor: colors.action },
});
