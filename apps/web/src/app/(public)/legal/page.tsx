import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_DRAFT_NOTICE } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Informations légales', alternates: { canonical: '/legal' } };

const DOCS = [
  { href: '/legal/cgu', title: 'Conditions générales d’utilisation', text: 'Accès au service, contenus, échanges entre membres, modération.' },
  { href: '/legal/confidentialite', title: 'Politique de confidentialité', text: 'Données collectées, conservation, vos droits (loi n° 2008-12), CDP.' },
  { href: '/legal/regles', title: 'Règles de la communauté', text: 'Articles interdits, conseils de sécurité, signalement et contestation.' },
];

export default function LegalIndex() {
  return (
    <div className="container-narrow legal">
      <h1>Informations légales</h1>
      <p className="legal-meta">{LEGAL_DRAFT_NOTICE}</p>
      <div className="stack-12" style={{ marginTop: 24 }}>
        {DOCS.map((d) => (
          <Link key={d.href} href={d.href} className="card card-pad" style={{ display: 'block' }}>
            <strong style={{ fontSize: 17 }}>{d.title}</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              {d.text}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
