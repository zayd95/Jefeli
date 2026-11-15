import { Camera, ImagePlus, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, colors, radius, spacing, Text, useToast } from '@/design';
import { avatarUrl } from '@/lib/media';
import { compressImage, newObjectPath, pickMedia, uploadErrorMessage, uploadWithRetry } from '@/lib/upload';

/** Picks, compresses and uploads a square-ish profile photo to the public avatars bucket. */
export function AvatarPicker({
  userId,
  name,
  path,
  onUploaded,
  size = 96,
}: {
  userId: string;
  name: string;
  path: string | null;
  onUploaded: (path: string) => void;
  size?: number;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function choose() {
    try {
      const picked = await pickMedia({ allowVideo: false });
      const first = picked?.[0];
      if (!first) return;
      setBusy(true);
      const img = await compressImage({ ...first, width: first.width, height: first.height });
      const objectPath = newObjectPath(userId, 'avatar', 'image/jpeg');
      await uploadWithRetry({ bucket: 'avatars', path: objectPath, uri: img.uri, mimeType: 'image/jpeg', file: img.file });
      onUploaded(objectPath);
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={choose} accessibilityRole="button" accessibilityLabel="Changer la photo de profil" style={styles.wrap}>
      <View>
        <Avatar path={path} name={name || 'J'} size={size} />
        <View style={styles.cam}>{busy ? <ActivityIndicator size="small" color={colors.ink} /> : <Camera size={16} color={colors.ink} />}</View>
      </View>
      <Text variant="callout" weight="600" tone="accent">
        {path ? 'Changer la photo' : 'Ajouter une photo'}
      </Text>
    </Pressable>
  );
}

/**
 * Profile cover (banner) in the public avatars bucket under {uid}/cover/… — the same ownership
 * rule as the avatar (profiles.cover_path must start with the member's id).
 */
export function CoverPicker({ userId, path, onChange }: { userId: string; path: string | null; onChange: (path: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const uri = avatarUrl(path);

  async function choose() {
    try {
      const picked = await pickMedia({ allowVideo: false });
      const first = picked?.[0];
      if (!first) return;
      setBusy(true);
      const img = await compressImage({ ...first, width: first.width, height: first.height });
      const objectPath = newObjectPath(userId, 'cover', 'image/jpeg');
      await uploadWithRetry({ bucket: 'avatars', path: objectPath, uri: img.uri, mimeType: 'image/jpeg', file: img.file });
      onChange(objectPath);
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="callout" weight="600">
        Photo de couverture
      </Text>
      <Pressable onPress={choose} disabled={busy} accessibilityRole="button" accessibilityLabel={path ? 'Changer la photo de couverture' : 'Ajouter une photo de couverture'} style={styles.cover}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={styles.coverLabel}>
          {busy ? <ActivityIndicator size="small" color={colors.ink} /> : <ImagePlus size={18} color={colors.ink} />}
          <Text variant="callout" weight="700">
            {path ? 'Changer' : 'Ajouter une couverture'}
          </Text>
        </View>
      </Pressable>
      {path ? (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" style={styles.coverRemove} hitSlop={8}>
          <X size={14} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" weight="600">
            Retirer la couverture
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  cover: { height: 120, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  coverLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.pill, backgroundColor: colors.surface },
  coverRemove: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 28 },
  cam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.action,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
