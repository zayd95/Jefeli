'use client';

import { useState, useSyncExternalStore } from 'react';
import { IconLink, IconMessage, IconShare } from './icons';

/**
 * Share without any tracking: WhatsApp share link, native share sheet when the browser offers
 * one, and copy-to-clipboard. Nothing is posted automatically.
 */
const noopSubscribe = () => () => {};

export function ShareActions({ url, text }: { url: string; text: string }) {
  const canNativeShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Lien copié');
    } catch {
      setStatus('Copie impossible\u00A0: sélectionnez l’adresse dans la barre du navigateur.');
    }
    window.setTimeout(() => setStatus(''), 3000);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: text, url });
    } catch {
      /* dismissed */
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

  return (
    <div>
      <div className="share-row">
        <a className="btn btn-outline btn-sm" href={whatsapp} target="_blank" rel="noopener noreferrer">
          <IconMessage width={17} height={17} /> WhatsApp
        </a>
        <button type="button" className="btn btn-outline btn-sm" onClick={copy}>
          <IconLink width={17} height={17} /> Copier le lien
        </button>
        {canNativeShare ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={nativeShare}>
            <IconShare width={17} height={17} /> Partager
          </button>
        ) : null}
      </div>
      <p className="share-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
