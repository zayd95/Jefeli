'use client';

import { useState, useSyncExternalStore } from 'react';
import { IconLink, IconMessage, IconShare } from './icons';

/**
 * Share without any tracking: WhatsApp share link, native share sheet when the browser offers
 * one, and copy-to-clipboard. Nothing is posted automatically: each action only prepares a
 * message that the visitor sends (or not) themselves.
 *
 * `text` is the page title; `message` is the short French sentence placed before the link in
 * WhatsApp and the native share sheet (defaults to `text`).
 */
const noopSubscribe = () => () => {};

/** wa.me opens WhatsApp (app or web) with the message pre-filled; the visitor picks the chat. */
function whatsappShareUrl(message: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
}

export function ShareActions({ url, text, message }: { url: string; text: string; message?: string }) {
  const canNativeShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );
  const [status, setStatus] = useState('');
  const body = message ?? text;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Lien copié');
    } catch {
      setStatus('Copie impossible : sélectionnez l’adresse dans la barre du navigateur.');
    }
    window.setTimeout(() => setStatus(''), 3000);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: text, text: body, url });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div>
      <div className="share-row" role="group" aria-label="Partager">
        <a
          className="btn btn-outline btn-sm"
          href={whatsappShareUrl(body, url)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Partager sur WhatsApp (nouvel onglet)"
        >
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
