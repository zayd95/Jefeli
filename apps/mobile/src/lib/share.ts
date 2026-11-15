import { formatListingPrice, shareUrls } from '@jefeli/shared';
import * as Clipboard from 'expo-clipboard';
import { Linking, Platform, Share } from 'react-native';

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
  product: (p: { id: string; title: string; price_xof: number | null; price_mode?: string | null; listing_mode?: string | null }) =>
    share(`${p.title} — ${formatListingPrice(p)} sur Jëfëli`, shareUrls.product(env.webBaseUrl, p.id)),
  post: (id: string, author: string) => share(`Une publication de ${author} sur Jëfëli`, shareUrls.post(env.webBaseUrl, id)),
  live: (id: string, host: string) => share(`${host} est en direct sur Jëfëli`, shareUrls.live(env.webBaseUrl, id)),
};

/**
 * Open WhatsApp with a ready-to-send message (contact picker in the app, or WhatsApp Web).
 * wa.me works whether or not the app is installed and needs no API key or business account.
 */
async function whatsapp(message: string, url: string) {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`);
}

type ShareableProduct = { id: string; title: string; price_xof: number | null; price_mode?: string | null; listing_mode?: string | null };

export const whatsappLinks = {
  product: (p: ShareableProduct) => whatsapp(`${p.title} — ${formatListingPrice(p)} sur Jëfëli`, shareUrls.product(env.webBaseUrl, p.id)),
  profile: (handle: string, name: string) => whatsapp(`Découvrez la boutique de ${name} sur Jëfëli`, shareUrls.profile(env.webBaseUrl, handle)),
};

export async function copyLink(url: string) {
  await Clipboard.setStringAsync(url);
}
