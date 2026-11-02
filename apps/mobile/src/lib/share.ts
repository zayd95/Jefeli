import { formatXOF, shareUrls } from '@jefeli/shared';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { env } from './env';

/** Native share sheet (WhatsApp, Facebook, TikTok bio…) with a public web URL. */
async function share(message: string, url: string): Promise<'shared' | 'copied' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator & { share?: (d: { text?: string; url?: string }) => Promise<void> };
    if (nav?.share) {
      try {
        await nav.share({ text: message, url });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    await Clipboard.setStringAsync(url);
    return 'copied';
  }
  const res = await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` });
  return res.action === Share.sharedAction ? 'shared' : 'dismissed';
}

export const shareLinks = {
  profile: (handle: string, name: string) =>
    share(`Découvrez ${name} sur Jëfëli`, shareUrls.profile(env.webBaseUrl, handle)),
  product: (id: string, title: string, price: number | null) =>
    share(`${title}${price !== null ? ` — ${formatXOF(price)}` : ''} sur Jëfëli`, shareUrls.product(env.webBaseUrl, id)),
  post: (id: string, author: string) => share(`Une publication de ${author} sur Jëfëli`, shareUrls.post(env.webBaseUrl, id)),
  live: (id: string, host: string) => share(`${host} est en direct sur Jëfëli`, shareUrls.live(env.webBaseUrl, id)),
};

export async function copyLink(url: string) {
  await Clipboard.setStringAsync(url);
}
