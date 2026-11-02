import { toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldOff } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Button, colors, EmptyState, Header, Screen, spacing, Text, useToast } from '@/design';
import { listBlocked, unblock } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

export default function Blocked() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['blocked', userId], queryFn: () => listBlocked(userId ?? '') });
  return (
    <Screen>
      <Header title="Comptes bloqués" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar path={item.avatar_path} name={item.display_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{item.display_name}</Text>
              <Text variant="caption" tone="secondary">
                @{item.handle}
              </Text>
            </View>
            <Button
              label="Débloquer"
              size="sm"
              variant="outline"
              onPress={async () => {
                try {
                  await unblock(userId ?? '', item.id);
                  qc.invalidateQueries();
                  toast(`${item.display_name} est débloqué(e)`, 'success');
                } catch (e) {
                  toast(toFrenchError(e), 'error');
                }
              }}
            />
          </View>
        )}
        ListEmptyComponent={q.isPending ? undefined : <EmptyState icon={ShieldOff} title="Aucun compte bloqué" body="Les comptes bloqués ne peuvent ni vous voir, ni vous écrire, ni commenter vos contenus." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
});
