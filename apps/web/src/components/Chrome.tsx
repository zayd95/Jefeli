import Link from 'next/link';
import { env } from '@/lib/env';
import { Wordmark } from './ui';

export function EnvBanner() {
  if (env.isProduction) return null;
  return (
    <div className="env-banner" role="note">
      <strong>Environnement de test</strong> · contenus DÉMO fictifs
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" aria-label="Jëfëli — accueil" style={{ display: 'inline-flex', alignItems: 'baseline' }}>
          <Wordmark />
          <span className="site-header-tagline">Découvre. Partage. Vends.</span>
        </Link>
        <nav aria-label="Liens utiles">
          <Link className="header-link" href="/legal/regles">
            Règles
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div>
          <Wordmark />
          <p className="footer-tagline">Le réseau social du commerce sénégalais · Phase pilote, Dakar</p>
        </div>
        <nav className="footer-links" aria-label="Informations légales">
          <Link href="/legal/cgu">Conditions d’utilisation</Link>
          <Link href="/legal/confidentialite">Confidentialité</Link>
          <Link href="/legal/regles">Règles de la communauté</Link>
        </nav>
      </div>
    </footer>
  );
}
