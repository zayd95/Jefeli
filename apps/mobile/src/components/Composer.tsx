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
        <Text variant="callout" weight="600">
          {label}
          {required ? ' *' : ''}
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
  return (
    <View style={styles.optionRow}>
      {options.map((o) => {
        const on = o.key === value;
        const fg = dark ? (on ? colors.ink : colors.white) : on ? colors.white : colors.ink;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.option, on && styles.optionOn, dark && styles.optionDark, dark && on && styles.optionDarkOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text variant="callout" weight="700" color={fg} align="center">
              {o.label}
            </Text>
            {o.hint ? (
              <Text variant="micro" weight="500" color={dark ? fg : on ? '#CFE3DD' : colors.textSecondary} align="center">
                {o.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumb: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  video: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cover: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,37,44,0.65)', paddingVertical: 2, alignItems: 'center' },
  remove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(16,37,44,0.75)', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' },
  optionDarkOn: { backgroundColor: colors.action, borderColor: colors.action },
});
