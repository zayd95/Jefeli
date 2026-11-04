import { shareUrls } from '@jefeli/shared';
import { Copy, Share2 } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, colors, Header, Screen, spacing, Text, useToast } from '@/design';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { copyLink, shareLinks } from '@/lib/share';

/**
 * Invitations without scraping anyone's contacts: a personal profile link + QR code to
 * share on WhatsApp/Facebook/TikTok bios or show in person at the market.
 */
export default function Invite() {
  const { profile } = useAuth();
  const toast = useToast();
  if (!profile) return null;
  const url = shareUrls.profile(env.webBaseUrl, profile.handle);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Inviter et partager" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, alignItems: 'stretch' }}>
        <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
          <Text variant="headline">{profile.display_name}</Text>
          <View style={styles.qr} accessibilityLabel={`QR code vers ${url}`}>
            <QRCode value={url} size={200} color={colors.ink} backgroundColor={colors.white} />
          </View>
          <Text variant="callout" tone="secondary" selectable>
            {url}
          </Text>
        </Card>
        <Button label="Partager mon profil" variant="cta" icon={Share2} onPress={() => shareLinks.profile(profile.handle, profile.display_name)} />
        <Button
          label="Copier le lien"
          variant="outline"
          icon={Copy}
          onPress={async () => {
            await copyLink(url);
            toast('Lien copié', 'success');
          }}
        />
        <Text variant="caption" tone="secondary">
          Mettez ce lien dans votre bio WhatsApp, Facebook, Instagram ou TikTok : vos clients verront votre boutique Jëfëli sans installer l’application. Jëfëli n’importe pas vos contacts et ne publie rien à votre place.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 12 },
});
