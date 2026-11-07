import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CONDITION_LABELS,
  DELIVERY_LABELS,
  LISTING_MODE_LABELS,
  PLATFORM_DISCLAIMER,
  PRODUCT_STATUS_LABELS,
  hasDisplayedPrice,
  shareUrls,
  timeAgo,
} from '@jefeli/shared';
import { Gallery, type GalleryItem } from '@/components/Gallery';
import { OPEN_IN_APP_NOTE, OpenInApp } from '@/components/OpenInApp';
import { appLinks, opensInBrowser } from '@/lib/app-links';
import { ShareActions } from '@/components/ShareActions';
import {
  IconBox,
  IconChevronRight,
  IconClock,
  IconHand,
  IconPin,
  IconShield,
  IconSwap,
  IconTag,
  IconTruck,
} from '@/components/icons';
import { Avatar, DemoChip, PriceText, ProductCard, Stars, VerifiedBadge, locationLabel, priceLabel } from '@/components/ui';
import { env } from '@/lib/env';
import { deName } from '@/lib/format';
import { avatarUrl, firstStill, publicMediaUrl, sortMedia } from '@/lib/media';
import { getProduct, getSellerProducts, ratingAverage } from '@/lib/public-data';

export const revalidate = 60;

// No paths at build time: each share page is rendered on first visit, then cached (ISR, 60 s).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

const DELIVERY_ICONS: Record<string, typeof IconHand> = { pickup: IconHand, delivery: IconTruck, shipping: IconBox };

function excerpt(text: string, max = 180): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: 'Article introuvable', robots: { index: false } };

  const url = shareUrls.product(env.siteUrl, product.id);
  // Same label as the page and the app: « Prix sur demande », « … · à discuter », never « 0 F ».
  const price = priceLabel(product);
  const status = product.status === 'active' ? '' : ` · ${PRODUCT_STATUS_LABELS[product.status]}`;
  const title = `${product.title} — ${price}${status}`;
  const where = locationLabel(product.neighborhood, product.city);
  const seller = product.seller ? `Vendu par ${product.seller.display_name}` : 'Sur Jëfëli';
  const description = [
    `${CONDITION_LABELS[product.condition]} · ${LISTING_MODE_LABELS[product.listing_mode]}${where ? ` · ${where}` : ''}.`,
    product.description ? excerpt(product.description, 140) : null,
    `${seller}.`,
  ]
    .filter(Boolean)
    .join(' ');
  const image = firstStill(product.product_media);
  const images = [{ url: image ?? '/og-default.png', alt: product.title }];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName: 'Jëfëli', locale: 'fr_SN', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const more = await getSellerProducts(product.seller_id, 7, product.id);
  const media: GalleryItem[] = sortMedia(product.product_media)
    .map((m): GalleryItem | null => {
      const url = publicMediaUrl(m.storage_path);
      if (!url) return null;
      return {
        kind: m.kind === 'video' ? 'video' : 'image',
        url,
        posterUrl: publicMediaUrl(m.poster_path),
        width: m.width,
        height: m.height,
      };
    })
    .filter((m): m is GalleryItem => m !== null);

  const seller = product.seller;
  const where = locationLabel(product.neighborhood, product.city);
  const shareUrl = shareUrls.product(env.siteUrl, product.id);
  const sellerRating = seller ? ratingAverage(seller.rating_sum, seller.rating_count) : null;
  const isAvailable = product.status === 'active';
  const price = priceLabel(product);
  // No amount shown (« Prix sur demande », « Prix à discuter », « À échanger »): a word label.
  const wordPrice = !hasDisplayedPrice(product);
  const askPrice = product.price_mode === 'on_request' || product.price_mode === 'negotiable';
  const shareMessage = `À voir sur Jëfëli\u00A0: ${product.title} — ${price}${isAvailable ? '' : ` (${PRODUCT_STATUS_LABELS[product.status].toLowerCase()})`}`;

  return (
    <div className="container">
      <div className="product-layout">
        <Gallery items={media} alt={product.title} status={product.status} />

        <div className="product-info">
          {seller?.is_demo ? (
            <p style={{ marginBottom: 10 }}>
              <DemoChip /> <span className="muted small">Annonce de démonstration</span>
            </p>
          ) : null}
          <p className={`product-price ${wordPrice ? 'is-label' : ''}`}>
            <PriceText product={product} />
          </p>
          <h1 className="product-title">{product.title}</h1>

          <div className="chip-row">
            {product.status !== 'active' ? (
              <span className="chip" style={{ background: 'var(--c-ink)', color: 'var(--c-white)' }}>
                {PRODUCT_STATUS_LABELS[product.status]}
              </span>
            ) : null}
            <span className="chip">{CONDITION_LABELS[product.condition]}</span>
            <span className="chip chip-mint">
              {product.listing_mode === 'sale' ? <IconTag /> : <IconSwap />}
              {LISTING_MODE_LABELS[product.listing_mode]}
            </span>
            {product.category ? <span className="chip chip-outline">{product.category.name}</span> : null}
          </div>

          <div className="meta-row">
            {where ? (
              <span>
                <IconPin /> {where}
              </span>
            ) : null}
            <span>
              <IconClock /> Publié {timeAgo(product.created_at)}
            </span>
            {product.quantity > 1 && isAvailable ? <span>{product.quantity} disponibles</span> : null}
          </div>

          <div className="cta-block cta-sticky">
            <OpenInApp
              href={appLinks.product(product.id)}
              label={
                isAvailable
                  ? opensInBrowser ? 'Écrire au vendeur' : 'Écrire au vendeur dans l’app'
                  : opensInBrowser ? 'Voir sur Jëfëli' : 'Ouvrir dans l’app'
              }
              note={
                // Kept to one short line: on a phone this bar is sticky and must not hide the price.
                isAvailable
                  ? askPrice
                    ? product.price_mode === 'on_request'
                      ? 'Le prix est donné par le vendeur en message.'
                      : 'Le prix se discute avec le vendeur en message.'
                    : OPEN_IN_APP_NOTE
                  : product.status === 'sold'
                    ? `Cet article est vendu. Découvrez les autres articles du vendeur ${opensInBrowser ? 'sur Jëfëli' : 'dans l’application'}.`
                    : 'Cet article est réservé pour le moment. Il peut redevenir disponible.'
              }
            />
          </div>
          {opensInBrowser ? null : <p className="cta-note">{OPEN_IN_APP_NOTE}</p>}

          <div className="stack-16" style={{ marginTop: 24 }}>
            {seller ? (
              <Link href={`/${seller.handle}`} className="card seller-card" aria-label={`Voir le profil et la boutique de ${seller.display_name}`}>
                <Avatar src={avatarUrl(seller.avatar_path)} name={seller.display_name} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div className="seller-name">
                    <span>{seller.display_name}</span>
                    {seller.verification_level === 'merchant_verified' ? <VerifiedBadge label={false} interactive={false} /> : null}
                  </div>
                  <div className="seller-sub">
                    @{seller.handle}
                    {sellerRating ? (
                      <>
                        {' · '}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'bottom' }}>
                          <Stars value={seller.rating_sum / seller.rating_count} />
                          {sellerRating} ({seller.rating_count})
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="seller-sub" style={{ color: 'var(--c-accent-deep)', fontWeight: 600 }}>
                    Voir sa boutique
                  </div>
                </div>
                <IconChevronRight className="chev" />
              </Link>
            ) : null}

            <section className="card card-pad" aria-labelledby="remise-title">
              <h2 className="block-title" id="remise-title">
                Remise de l’article
              </h2>
              <ul className="info-list">
                {product.delivery_options.map((opt) => {
                  const Icon = DELIVERY_ICONS[opt] ?? IconBox;
                  return (
                    <li key={opt}>
                      <Icon />
                      <span>{DELIVERY_LABELS[opt] ?? opt}</span>
                    </li>
                  );
                })}
              </ul>
              {product.delivery_notes.trim() ? (
                <p className="muted small prewrap" style={{ marginTop: 12 }}>
                  {product.delivery_notes}
                </p>
              ) : null}
            </section>

            {product.description.trim() ? (
              <section className="card card-pad" aria-labelledby="desc-title">
                <h2 className="block-title" id="desc-title">
                  Description
                </h2>
                <p className="prewrap">{product.description}</p>
              </section>
            ) : null}

            <div className="safety" role="note">
              <IconShield />
              <p>
                {PLATFORM_DISCLAIMER} <Link href="/legal/regles">Règles et conseils de sécurité</Link>
              </p>
            </div>

            <ShareActions url={shareUrl} text={`${product.title} — ${price}`} message={shareMessage} />
          </div>
        </div>
      </div>

      {more.length > 0 && seller ? (
        <section className="section" aria-labelledby="more-title" style={{ marginTop: 40 }}>
          <div className="section-head">
            <h2 className="section-title" id="more-title">
              Dans la boutique {deName(seller.display_name)}
            </h2>
            <Link href={`/${seller.handle}`} className="section-meta" style={{ fontWeight: 600, color: 'var(--c-ink)' }}>
              Tout voir
            </Link>
          </div>
          <div className="product-grid cols-4">
            {more.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
