/**
 * Pilot cut (e) — the WhatsApp status card of an article: a 1080 × 1920 (9:16) PNG with the photo,
 * the price, the « Troquer » badge when the article can be swapped, and the short link to the
 * public article page. The app downloads it and hands it to the share sheet (WhatsApp › Statut);
 * the link goes in the status caption (copied for the seller), since an image cannot hold a link.
 *
 * Public data only (the same RLS-limited read as the article page): a hidden, removed or archived
 * article returns 404. Rendered on demand on the free Vercel plan; cached at the edge for 10 min.
 */
import { formatListingPrice, palette } from '@jefeli/shared';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '@/lib/env';
import { publicMediaUrl } from '@/lib/media';
import { getProduct } from '@/lib/public-data';

export const runtime = 'nodejs';

const W = 1080;
const H = 1920;
const FONTS = path.join(process.cwd(), 'assets', 'fonts');

async function font(file: string) {
  return readFile(path.join(FONTS, file));
}

/** The photo as a data URL (satori reads PNG / JPEG only); null when it cannot be used. */
async function photo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product || product.status === 'archived') return new Response('Not found', { status: 404 });

  const media = [...(product.product_media ?? [])].sort((a, b) => a.position - b.position)[0];
  const img = await photo(publicMediaUrl(media ? (media.kind === 'video' ? media.poster_path : media.storage_path) : null));
  const swap = product.listing_mode !== 'sale';
  const price = product.listing_mode === 'trade' ? 'À troquer' : formatListingPrice(product, { compact: true });
  const link = `${env.siteUrl.replace(/^https?:\/\//, '')}/p/${product.id}`;
  const [bold, extra, black] = await Promise.all([font('Nunito_700Bold.ttf'), font('Nunito_800ExtraBold.ttf'), font('Nunito_900Black.ttf')]);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: palette.canvas, fontFamily: 'Nunito' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '64px 72px 40px' }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: palette.ink }}>
            Jëfëli<span style={{ color: palette.gold }}>.</span>
          </div>
          {product.status === 'reserved' ? (
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: palette.ink, background: palette.raised, borderRadius: 999, padding: '12px 28px' }}>Réservé</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', margin: '0 56px', height: 1080, borderRadius: 40, overflow: 'hidden', background: palette.surface }}>
          {img ? (
            <img src={img} width={W - 112} height={1080} style={{ objectFit: 'cover', width: W - 112, height: 1080 }} alt="" />
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 48, color: palette.slate }}>Photo sur Jëfëli</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 72px 0', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, color: palette.gold, lineHeight: 1.05 }}>{price}</div>
            {swap && product.listing_mode !== 'trade' ? (
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: palette.onGold, background: palette.mint, borderRadius: 999, padding: '10px 30px' }}>Troquer</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: palette.ink, lineHeight: 1.15, maxHeight: 136, overflow: 'hidden' }}>{product.title}</div>
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', margin: '0 56px 72px', padding: '28px 36px', borderRadius: 32, background: palette.surface, gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: palette.slate }}>Écris-moi ou fais une offre :</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: palette.ink }}>{link}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Nunito', data: bold, weight: 700, style: 'normal' },
        { name: 'Nunito', data: extra, weight: 800, style: 'normal' },
        { name: 'Nunito', data: black, weight: 900, style: 'normal' },
      ],
      // The app (another origin on the web) downloads it to share it.
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600', 'Access-Control-Allow-Origin': '*' },
    },
  );
}
