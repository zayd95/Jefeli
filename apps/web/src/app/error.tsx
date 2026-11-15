'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { env } from '@/lib/env';

/**
 * Error boundary for every page (public pages and the moderation console). Without it, a
 * client-side exception leaves a blank page. Outside production the technical message is shown
 * so testers can send a screenshot of it.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="contenu">
      <div className="container">
        <div className="message-page" role="alert">
          <span className="code">Erreur</span>
          <h1>Cette page n’a pas pu s’afficher</h1>
          <p>Réessayez. Si le problème continue, envoyez une capture de cet écran à l’équipe.</p>
          {!env.isProduction ? (
            <pre className="error-detail">
              {error.name}: {error.message}
              {error.digest ? `\nRéférence : ${error.digest}` : ''}
              {typeof navigator !== 'undefined' ? `\n${navigator.userAgent}` : ''}
            </pre>
          ) : error.digest ? (
            <p className="muted">Référence : {error.digest}</p>
          ) : null}
          <div className="error-actions">
            <button type="button" className="btn btn-dark" onClick={reset}>
              Réessayer
            </button>
            <Link className="btn btn-outline" href="/admin/signalements">
              Console de modération
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
