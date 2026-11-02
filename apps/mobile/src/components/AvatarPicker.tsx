import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, colors, Text, useToast } from '@/design';
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

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
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
