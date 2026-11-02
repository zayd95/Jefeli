import { initials } from '@jefeli/shared';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl } from '@/lib/media';

import { Text } from './Text';
import { colors } from './theme';

export interface AvatarProps {
  path?: string | null;
  name: string;
  size?: number;
  border?: boolean;
}

const fallbackTints = ['#D7F1E9', '#E8E3D6', '#DCE6EE', '#EDE2E4', '#E3EBDC'];

export function Avatar({ path, name, size = 40, border }: AvatarProps) {
  const url = avatarUrl(path);
  const tint = fallbackTints[(name.charCodeAt(0) || 0) % fallbackTints.length];
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint, overflow: 'hidden' },
        border && { borderWidth: Math.max(2, size / 22), borderColor: colors.background },
        styles.center,
      ]}
      accessibilityLabel={`Photo de ${name}`}
      accessibilityRole="image"
    >
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={url} />
      ) : (
        <Text weight="700" color={colors.ink} style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/** Status ring: mint ring = unseen, hairline grey = seen. */
export function StoryRing({
  path,
  name,
  label,
  seen,
  size = 60,
  onPress,
  addBadge,
  live,
}: {
  path?: string | null;
  name: string;
  label: string;
  seen?: boolean;
  size?: number;
  onPress?: () => void;
  addBadge?: boolean;
  live?: boolean;
}) {
  const ringColor = live ? colors.live : seen ? colors.borderStrong : colors.accentDeep;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={addBadge ? 'Ajouter un statut' : `Voir le statut de ${name}`}
      style={({ pressed }) => [styles.story, { width: size + 12 }, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderColor: ringColor, borderWidth: seen ? 1.5 : 2.2 }]}>
        <Avatar path={path} name={name} size={size} />
        {addBadge ? (
          <View style={styles.add}>
            <Plus size={13} color={colors.ink} strokeWidth={3} />
          </View>
        ) : null}
        {live ? (
          <View style={styles.liveTag}>
            <Text variant="micro" color={colors.white} weight="800" style={{ fontSize: 9, lineHeight: 11 }}>
              LIVE
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 6, maxWidth: size + 12, fontSize: 11.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  story: { alignItems: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  add: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.action,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTag: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: colors.live,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
