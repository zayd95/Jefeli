'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_STATUS_LABELS } from '@jefeli/shared';
import type { ProductStatus } from '@jefeli/shared';
import { IconImage, IconPlay } from './icons';

export type GalleryItem = {
  kind: 'image' | 'video';
  url: string;
  posterUrl: string | null;
  width?: number | null;
  height?: number | null;
};

/** Swipeable (scroll-snap) media gallery; thumbnails on desktop. Works without JS too. */
export function Gallery({ items, alt, status }: { items: GalleryItem[]; alt: string; status: ProductStatus }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setIndex(Math.min(items.length - 1, Math.max(0, i)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [items.length]);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIndex(i);
  }, []);

  const overlay =
    status === 'sold' || status === 'reserved' ? (
      <div className={`status-overlay is-large ${status === 'reserved' ? 'is-reserved' : ''}`}>
        <span>{PRODUCT_STATUS_LABELS[status]}</span>
      </div>
    ) : null;

  if (items.length === 0) {
    return (
      <div className="gallery">
        <div className="gallery-frame">
          <div className="gallery-track">
            <div className="gallery-slide">
              <div className="media-placeholder">
                <IconImage />
              </div>
            </div>
          </div>
          {overlay}
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-frame">
        <div
          className="gallery-track"
          ref={track}
          tabIndex={0}
          role="region"
          aria-roledescription="carrousel"
          aria-label={`Photos et vidéos\u00A0: ${alt}`}
        >
          {items.map((m, i) => (
            <div
              className="gallery-slide"
              key={m.url}
              role="group"
              aria-roledescription="diapositive"
              aria-label={`${i + 1} sur ${items.length}`}
            >
              {m.kind === 'video' ? (
                <video
                  src={m.url}
                  poster={m.posterUrl ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  aria-label={`Vidéo\u00A0: ${alt}`}
                />
              ) : (
                <img
                  src={m.url}
                  alt={items.length > 1 ? `${alt} (photo ${i + 1})` : alt}
                  width={m.width ?? 900}
                  height={m.height ?? 900}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  decoding="async"
                />
              )}
            </div>
          ))}
        </div>
        {overlay}
        {items.length > 1 ? (
          <span className="gallery-count" aria-hidden>
            {index + 1} / {items.length}
          </span>
        ) : null}
      </div>
      {items.length > 1 ? (
        <>
          <div className="gallery-dots" aria-hidden>
            {items.map((m, i) => (
              <span key={m.url} className={i === index ? 'on' : undefined} />
            ))}
          </div>
          <div className="gallery-thumbs">
            {items.map((m, i) => (
              <button
                type="button"
                key={m.url}
                className="gallery-thumb"
                aria-current={i === index}
                aria-label={`Afficher ${m.kind === 'video' ? 'la vidéo' : 'la photo'} ${i + 1}`}
                onClick={() => goTo(i)}
              >
                {m.kind === 'video' && !m.posterUrl ? (
                  <span className="media-placeholder">
                    <IconPlay />
                  </span>
                ) : (
                  <img src={m.kind === 'video' ? (m.posterUrl as string) : m.url} alt="" loading="lazy" decoding="async" />
                )}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
