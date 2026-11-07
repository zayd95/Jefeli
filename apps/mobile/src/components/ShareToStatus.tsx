/**
 * « Partager en statut » (W1.2): a 24-hour status that points to one of your publications or
 * articles. Nothing is uploaded again (data costs); expiry removes the status only. The audience
 * can never be wider than the publication's (the server refuses it too).
 */
import { toFrenchError, type Audience } from '@jefeli/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ChoicePills } from '@/components/Composer';
import { Button, colors, fonts, Sheet, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { shareToStatus } from '@/lib/api/stories';

const ALL: { key: Audience; label: string; a11y: string }[] = [
  { key: 'public', label: 'Tout le monde', a11y: 'Tout le monde' },
  { key: 'followers', label: 'Abonnés', a11y: 'Mes abonnés' },
  { key: 'friends', label: 'Amis', a11y: 'Mes amis' },
];

/** Audiences allowed for a status pointing to a publication seen by `visibility`. */
export function audiencesFor(visibility: string | null | undefined): typeof ALL {
  if (visibility === 'friends') return ALL.filter((a) => a.key === 'friends');
  if (visibility === 'followers') return ALL.filter((a) => a.key !== 'public');
  return ALL;
}

export function ShareToStatusSheet({
  visible,
  onClose,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  target: { postId?: string; productId?: string; visibility?: string | null };
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const options = audiencesFor(target.visibility);
  const [audience, setAudience] = useState<Audience>(options.some((o) => o.key === 'followers') ? 'followers' : options[0]!.key);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      await shareToStatus({ postId: target.postId, productId: target.productId, caption: caption.trim(), audience });
      qc.invalidateQueries({ queryKey: ['story-rail'] });
      qc.invalidateQueries({ queryKey: ['stories'] });
      toast('Statut publié pour 24 heures', 'success');
      setCaption('');
      onClose();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Partager en statut">
      <View style={{ gap: spacing.md }}>
        <Text variant="caption" tone="secondary">
          Visible 24 heures. {target.postId ? 'La publication' : 'L’article'} reste en place, rien n’est renvoyé.
        </Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Une légende (facultatif)"
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
          accessibilityLabel="Légende du statut"
          style={[{ minHeight: 48, borderRadius: 14, backgroundColor: colors.surfaceSubtle, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }, WEB_NO_OUTLINE]}
        />
        <ChoicePills<Audience> value={audience} onChange={setAudience} options={options} />
        <Button label="Partager en statut" variant="cta" loading={busy} onPress={share} />
      </View>
    </Sheet>
  );
}
