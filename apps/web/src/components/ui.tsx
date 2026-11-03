import Link from 'next/link';
import {
  CONDITION_LABELS,
  LISTING_MODE_LABELS,
  PRODUCT_STATUS_LABELS,
  formatListingPrice,
  initials,
} from '@jefeli/shared';
import type { ProductStatus } from '@jefeli/shared';
import { firstStill } from '@/lib/media';
import type { ProductCardRow } from '@/lib/public-data';
import { IconImage, IconPlay, IconPushpin, IconStar, IconVerified } from './icons';

export const VERIFIED_EXPLANATION =
  'Informations vendeur examinées par l’équipe Jëfëli. Ne garantit pas les produits.';

export function Wordmark({ size, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`wordmark ${className}`} style={size ? { fontSize: size } : undefined}>
      Jëfëli
      <span className="wordmark-dot" aria-hidden />
    </span>
  );
}

export function Avatar({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" /> : <span aria-hidden>{initials(name)}</span>}
    </span>
  );
}

/**
 * Shown ONLY for verification_level = 'merchant_verified'. Tooltip on hover / focus / tap.
 * Inside a link (interactive=false) the badge is not focusable; the explanation stays in its label.
 */
export function VerifiedBadge({ label = true, interactive = true }: { label?: boolean; interactive?: boolean }) {
  return (
    <span
      className="verified"
      tabIndex={interactive ? 0 : undefined}
      role="img"
      aria-label={`Vendeur vérifié. ${VERIFIED_EXPLANATION}`}
      title={interactive ? undefined : VERIFIED_EXPLANATION}
    >
      <IconVerified />
      {label ? <span aria-hidden>Vendeur vérifié</span> : null}
      {interactive ? (
        <span className="verified-tip" aria-hidden>
          {VERIFIED_EXPLANATION}
        </span>
      ) : null}
    </span>
  );
}

export function DemoChip() {
  return (
    <span className="chip chip-demo" title="Compte de démonstration : contenus fictifs">
      DÉMO
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} filled={i <= rounded} className={i <= rounded ? undefined : 'off'} />
      ))}
    </span>
  );
}

export function StatusOverlay({ status, large = false }: { status: ProductStatus; large?: boolean }) {
  if (status !== 'sold' && status !== 'reserved') return null;
  return (
    <div className={`status-overlay ${status === 'reserved' ? 'is-reserved' : ''} ${large ? 'is-large' : ''}`}>
      <span>{PRODUCT_STATUS_LABELS[status]}</span>
    </div>
  );
}

type PricedListing = Pick<ProductCardRow, 'price_xof' | 'price_mode' | 'listing_mode'>;

/**
 * How a listing's price reads on the web — the shared formatListingPrice rules, so the share
 * pages match the app: « 25 000 F CFA », « Prix sur demande », « 25 000 F CFA · à discuter »,
 * « Prix à discuter », « À échanger ». Never « 0 F », never an invented amount.
 * Regular no-break spaces: the narrow one renders too tight in Inter at UI sizes.
 */
export function priceLabel(p: PricedListing, compact = false): string {
  return formatListingPrice(p, { compact }).replace(/\u202F/g, '\u00A0');
}

/** The price label, with a trailing « · à discuter » set in a quieter style. Text is unchanged. */
export function PriceText({ product, compact = false }: { product: PricedListing; compact?: boolean }) {
  const label = priceLabel(product, compact);
  // Strong digits, quiet currency and « · à discuter » (same as the app's PriceLabel).
  const m = /^(.*\d)(\u00A0F(?: CFA)?)(.*)$/.exec(label);
  if (m) {
    return (
      <>
        {m[1]}
        <span className="price-note">{(m[2] ?? '') + (m[3] ?? '')}</span>
      </>
    );
  }
  const cut = label.indexOf(' · ');
  if (cut < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, cut)}
      <span className="price-note">{label.slice(cut)}</span>
    </>
  );
}

/** « Épinglé » marker for posts and listings the owner pinned to the top of their profile. */
export function PinnedChip({ className = '' }: { className?: string }) {
  return (
    <span className={`pinned-chip ${className}`}>
      <IconPushpin /> Épinglé
    </span>
  );
}

/** `showPinned`: mark pinned listings « Épinglé » (only on the seller's own storefront). */
export function ProductCard({ product, showPinned = false }: { product: ProductCardRow; showPinned?: boolean }) {
  const still = firstStill(product.product_media);
  const hasVideo = product.product_media.some((m) => m.kind === 'video');
  const price = priceLabel(product, true);
  // « Vente ou troc » / « À échanger » under the price, unless the price line already says it.
  const modeNote = product.listing_mode === 'sale' ? null : LISTING_MODE_LABELS[product.listing_mode];
  const pinned = showPinned && product.pinned_at !== null;
  return (
    <Link href={`/p/${product.id}`} className={`product-card ${product.status === 'sold' ? 'is-sold' : ''}`}>
      <div className="product-card-media">
        {still ? (
          <img src={still} alt={product.title} loading="lazy" decoding="async" width={400} height={400} />
        ) : (
          <div className="media-placeholder">
            <IconImage />
          </div>
        )}
        {hasVideo ? (
          <span className="media-badge">
            <IconPlay /> Vidéo
          </span>
        ) : null}
        <StatusOverlay status={product.status} />
        {pinned ? <PinnedChip className="is-overlay" /> : null}
      </div>
      <div className="product-card-body">
        <div className="product-card-price">
          <PriceText product={product} compact />
        </div>
        <div className="product-card-title">{product.title}</div>
        <div className="product-card-meta">
          {CONDITION_LABELS[product.condition]}
          {modeNote && modeNote !== price ? ` · ${modeNote}` : ''}
        </div>
      </div>
    </Link>
  );
}

export function locationLabel(neighborhood: string | null, city: string | null): string | null {
  const parts = [neighborhood, city].filter((x): x is string => !!x && x.trim().length > 0);
  if (parts.length === 2 && parts[0]!.toLowerCase() === parts[1]!.toLowerCase()) return parts[0]!;
  return parts.length ? parts.join(', ') : null;
}
