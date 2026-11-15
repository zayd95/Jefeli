import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { QrCode, UserPlus } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ProfileName } from '@/components/ProfileName';
import { Avatar, Button, colors, EmptyState, Header, Screen, spacing, Text, useToast } from '@/design';
import { incomingFriendRequests, respondFriendRequest } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

export default function FriendRequests() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['friend-requests'], queryFn: () => incomingFriendRequests(userId ?? '') });

  async function respond(id: string, accept: boolean) {
    try {
      await respondFriendRequest(id, accept);
      toast(accept ? 'Vous êtes maintenant amis' : 'Demande refusée', 'success');
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  return (
    <Screen>
      <Header title="Demandes d’ami" right={<Button label="Inviter" size="sm" variant="soft" icon={QrCode} onPress={() => router.push('/invite')} style={{ marginRight: spacing.sm }} />} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) =>
          item.sender ? (
            <View style={styles.row}>
              <Pressable onPress={() => router.push(`/u/${item.sender!.handle}`)} style={{ flexDirection: 'row', gap: spacing.md, flex: 1, alignItems: 'center' }}>
                <Avatar path={item.sender.avatar_path} name={item.sender.display_name} size={46} />
                <View style={{ flex: 1 }}>
                  <ProfileName profile={item.sender} />
                  <Text variant="caption" tone="secondary">
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
              </Pressable>
              <Button label="Accepter" size="sm" variant="cta" onPress={() => respond(item.id, true)} />
              <Button label="Refuser" size="sm" variant="ghost" onPress={() => respond(item.id, false)} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          q.isPending ? undefined : (
            <EmptyState
              icon={UserPlus}
              title="Aucune demande en attente"
              body="« Ajouter en ami » crée un lien mutuel. « Suivre » permet simplement de voir les publications publiques."
              actionLabel="Inviter des proches"
              onAction={() => router.push('/invite')}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
});
