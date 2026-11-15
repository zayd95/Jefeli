import { shareUrls } from '@jefeli/shared';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { env } from './env';

/**
 * Pilot cut (e) — one tap to a WhatsApp status: the 9:16 card of an article (rendered by the public
 * web site, apps/web › /p/<id>/status-card) goes to the share sheet, where the seller picks
 * WhatsApp › Mon statut. A status image cannot carry a link, so the article's public link is copied
 * at the same time, ready to paste as the caption.
 *
 * Outcomes: 'shared' (the share sheet took the image), 'downloaded' (a browser that cannot share
 * files saved it instead), 'dismissed'.
 */
export type StatusCardResult = 'shared' | 'downloaded' | 'dismissed';

export function statusCardUrl(productId: string): string {
  return `${env.webBaseUrl}/p/${productId}/status-card`;
}

export async function shareStatusCard(p: { id: string; title: string }): Promise<StatusCardResult> {
  const link = shareUrls.product(env.webBaseUrl, p.id);
  const caption = `${p.title} — sur Jëfëli : ${link}`;
  await Clipboard.setStringAsync(caption).catch(() => {});
  const name = `jefeli-statut-${p.id.slice(0, 8)}.png`;

  if (Platform.OS === 'web') {
    const res = await fetch(statusCardUrl(p.id));
    if (!res.ok) throw new Error('status_card_unavailable');
    const blob = await res.blob();
    const file = new globalThis.File([blob], name, { type: 'image/png' });
    const nav = globalThis.navigator as Navigator & { canShare?: (d: { files: unknown[] }) => boolean; share?: (d: { files?: unknown[]; text?: string }) => Promise<void> };
    if (nav?.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], text: caption });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    // Desktop browsers: save the image (WhatsApp Web › Statut accepts it from the computer).
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.dataset.testid = 'status-card-download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return 'downloaded';
  }

  const dest = new File(Paths.cache, name);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(statusCardUrl(p.id), dest);
  if (!(await Sharing.isAvailableAsync())) throw new Error('share_unavailable');
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Partager en statut WhatsApp' });
  return 'shared';
}
