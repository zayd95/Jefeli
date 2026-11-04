import Link from 'next/link';
import { IconAlert } from './icons';

export type LegalKey = 'cgu' | 'confidentialite' | 'regles';

const DOCS: { key: LegalKey; href: string; label: string }[] = [
  { key: 'cgu', href: '/legal/cgu', label: 'Conditions d’utilisation' },
  { key: 'confidentialite', href: '/legal/confidentialite', label: 'Confidentialité' },
  { key: 'regles', href: '/legal/regles', label: 'Règles de la communauté' },
];

export const LEGAL_DRAFT_NOTICE = 'Projet — à valider par le propriétaire et un conseil juridique avant lancement.';

/** Placeholder the owner must fill before launch (highlighted on purpose). */
export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="placeholder">[{children}]</span>;
}

export function LegalPage({
  current,
  title,
  version,
  toc,
  children,
}: {
  current: LegalKey;
  title: string;
  version: string;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="container-narrow legal">
      <nav className="legal-nav" aria-label="Documents">
        {DOCS.map((d) => (
          <Link key={d.key} href={d.href} aria-current={d.key === current ? 'page' : undefined}>
            {d.label}
          </Link>
        ))}
      </nav>
      <div className="legal-draft" role="note">
        <IconAlert />
        <p>
          <strong>{LEGAL_DRAFT_NOTICE}</strong> Ce texte est un brouillon de travail pour la phase pilote&nbsp;: il ne
          constitue pas un avis juridique et les éléments entre crochets restent à compléter.
        </p>
      </div>
      <h1>{title}</h1>
      <p className="legal-meta">{version}</p>
      <nav className="card legal-toc" aria-label="Sommaire">
        <p className="eyebrow">Sommaire</p>
        <ol>
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`}>{t.label}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="legal-body">{children}</div>
    </div>
  );
}
