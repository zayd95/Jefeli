'use client';

import Link from 'next/link';

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container">
      <div className="message-page" role="alert">
        <span className="code">ERREUR</span>
        <h1>Cette page n’a pas pu être chargée</h1>
        <p>Le service est peut-être momentanément indisponible. Vérifiez votre connexion puis réessayez.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-dark" onClick={() => reset()}>
            Réessayer
          </button>
          <Link className="btn btn-outline" href="/">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
