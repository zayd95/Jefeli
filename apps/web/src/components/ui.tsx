import Link from 'next/link';
import {
  CONDITION_LABELS,
  LISTING_MODE_LABELS,
  PRODUCT_STATUS_LABELS,
  initials,
} from '@jefeli/shared';
import type { ProductStatus } from '@jefeli/shared';
import { xof } from '@/lib/format';
import { firstStill } from '@/lib/media';
import type { ProductCardRow } from '@/lib/public-data';
import { IconImage, IconPlay, IconStar, IconVerified } from './icons';

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

export function priceLabel(p: { price_xof: number | null; listing_mode: ProductCardRow['listing_mode'] }, compact = false): string {
  if (p.price_xof === null) return 'À échanger';
  return xof(p.price_xof, { compact });
}

export function ProductCard({ product }: { product: ProductCardRow }) {
  const still = firstStill(product.product_media);
  const hasVideo = product.product_media.some((m) => m.kind === 'video');
  const modeNote = product.listing_mode === 'sale' ? null : LISTING_MODE_LABELS[product.listing_mode];
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
      </div>
      <div className="product-card-body">
        <div className="product-card-price">{priceLabel(product, true)}</div>
        <div className="product-card-title">{product.title}</div>
        <div className="product-card-meta">
          {CONDITION_LABELS[product.condition]}
          {modeNote && product.price_xof !== null ? ` · ${modeNote}` : ''}
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
