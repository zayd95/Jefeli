/**
 * « Un brouillon vous attend » (W1.3): continue it, or start anew after an explicit confirmation.
 * Used by the « + » menu (dark, over the feed) and by the editors when they are opened from
 * anywhere else with a draft present. A draft is never replaced or deleted without this choice.
 */
import { FileText, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, colors, dark, radius, spacing, Text } from '@/design';

export function DraftChoice({
  kind,
  summary,
  onContinue,
  onNew,
  onDismiss,
  tone = 'light',
}: {
  kind: 'post' | 'listing';
  summary: string;
  onContinue: () => void;
  /** Called only after « Supprimer et commencer ». */
  onNew: () => void | Promise<void>;
  /** Menu only: back to the three cards. */
  onDismiss?: () => void;
  tone?: 'light' | 'dark';
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDark = tone === 'dark';
  const what = kind === 'post' ? 'publication' : 'article';
  const fg = isDark ? 'fog' : 'default';
  const sub = isDark ? 'fogSecondary' : 'secondary';

  return (
    <View style={[styles.box, isDark ? styles.boxDark : styles.boxLight]} accessibilityLiveRegion="polite" testID="draft-choice">
      {confirming ? (
        <>
          <Text variant="headline" tone={fg} accessibilityRole="header">
            Supprimer le brouillon ?
          </Text>
          <Text variant="callout" tone={sub}>
            {`Votre brouillon (${summary}) sera supprimé. Cette action est définitive.`}
          </Text>
          <View style={styles.actions}>
            <Button
              label="Supprimer et commencer"
              variant="danger"
              pill
              icon={Trash2}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await onNew();
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button label="Garder le brouillon" variant={isDark ? 'ghostDark' : 'ghost'} pill onPress={() => setConfirming(false)} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.head}>
            <View style={[styles.icon, isDark && { backgroundColor: dark.mintSoft, borderColor: dark.mintLine, borderWidth: 1 }]}>
              <FileText size={18} color={isDark ? dark.mint : colors.accentDeep} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="headline" tone={fg} accessibilityRole="header">
                {kind === 'post' ? 'Une publication vous attend' : 'Un article vous attend'}
              </Text>
              <Text variant="callout" tone={sub} numberOfLines={2}>
                {`Brouillon : ${summary}`}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button label="Continuer le brouillon" variant="cta" pill icon={FileText} onPress={onContinue} />
            <Button label={kind === 'post' ? 'Nouvelle publication' : 'Nouvel article'} variant={isDark ? 'outlineDark' : 'outline'} pill icon={Plus} onPress={() => setConfirming(true)} accessibilityHint={`Le brouillon de ${what} sera supprimé après confirmation`} />
            {onDismiss ? <Button label="Retour" variant={isDark ? 'ghostDark' : 'ghost'} pill onPress={onDismiss} /> : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xxl, width: '100%', maxWidth: 380 },
  boxLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  boxDark: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.borderStrong },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
