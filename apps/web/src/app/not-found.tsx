import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/Chrome';

export default function GlobalNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenu">
        <div className="container">
          <div className="message-page">
            <span className="code">404</span>
            <h1>Cette page est introuvable</h1>
            <p>Le lien est peut-être incorrect, ou le contenu n’est plus disponible.</p>
            <Link className="btn btn-dark" href="/">
              Découvrir Jëfëli
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
