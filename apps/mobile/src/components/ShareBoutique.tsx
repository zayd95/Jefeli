import { toFrenchError } from '@jefeli/shared';
import { Image } from 'expo-image';
import { MessageCircle, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, radius, Sheet, spacing, Text, useToast } from '@/design';
import { whatsappLinks } from '@/lib/share';
import { shareStatusCard, statusCardUrl, type StatusCardResult } from '@/lib/statusCard';

const DONE: Record<StatusCardResult, string | null> = {
  shared: 'Lien copié : collez-le en légende de votre statut.',
  downloaded: 'Image enregistrée et lien copié : ajoutez-les à votre statut WhatsApp.',
  dismissed: null,
};

/** One-tap WhatsApp status card for an article (pilot cut e). */
export function StatusCardButton({ product, variant = 'soft' }: { product: { id: string; title: string }; variant?: 'soft' | 'cta' | 'outline' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      label="Statut WhatsApp"
      variant={variant}
      icon={Smartphone}
      loading={busy}
      accessibilityLabel="Partager en statut WhatsApp (image 9:16 avec prix et lien)"
      onPress={async () => {
        setBusy(true);
        try {
          const done = DONE[await shareStatusCard(product)];
          if (done) toast(done, 'success');
        } catch (e) {
          toast(toFrenchError(e), 'error');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/**
 * Pilot cut (e) — « Partage ta boutique »: shown once, right after a seller's first listing. The
 * 9:16 status card of that article, one tap to the WhatsApp status, or the boutique link to send
 * in WhatsApp chats. Nothing is posted anywhere without the seller choosing it.
 */
export function ShareBoutiqueMoment({
  visible,
  onClose,
  product,
  seller,
}: {
  visible: boolean;
  onClose: () => void;
  product: { id: string; title: string };
  seller: { handle: string; display_name: string } | null;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Partage ta boutique" tone="dark">
      <View style={{ gap: spacing.md }} testID="share-boutique-moment">
        <Text variant="callout" tone="secondary">
          Ton premier article est en ligne. Montre-le à tes contacts : un statut WhatsApp, et ta boutique s’ouvre pour eux sans compte.
        </Text>
        <View style={{ alignItems: 'center' }}>
          <Image
            source={{ uri: statusCardUrl(product.id) }}
            style={{ width: 135, height: 240, borderRadius: radius.lg }}
            contentFit="cover"
            accessibilityLabel={`Aperçu du statut : ${product.title}`}
          />
        </View>
        <StatusCardButton product={product} variant="cta" />
        {seller ? (
          <Button
            label="Envoyer ma boutique sur WhatsApp"
            variant="outline"
            icon={MessageCircle}
            onPress={() => {
              void whatsappLinks.profile(seller.handle, seller.display_name);
            }}
          />
        ) : null}
        <Button label="Plus tard" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
