import { opensInBrowser } from '@/lib/app-links';

import { IconExternal } from './icons';

/**
 * Honest explanation shown under every « open » button by default: the web beta opens in the
 * browser; the native pilot app may not be installed.
 */
export const OPEN_IN_APP_NOTE = opensInBrowser
  ? 'Jëfëli s’ouvre dans votre navigateur : rien à télécharger.'
  : 'Le bouton ouvre l’application Jëfëli si elle est installée sur ce téléphone. L’application est en phase pilote : si rien ne se passe, elle n’est pas encore installée.';

/**
 * Link into Jëfëli: the web app during the web beta (same tab), else the native app (jefeli://…).
 * There is no store listing yet, so the native fallback is an honest explanation rather than a
 * fake download link.
 */
export function OpenInApp({ href, label, note }: { href: string; label: string; note?: string }) {
  return (
    <div>
      <a className="btn btn-primary btn-block" href={href}>
        {label}
        {opensInBrowser ? null : <IconExternal width={18} height={18} />}
      </a>
      <p className="cta-note">{note ?? OPEN_IN_APP_NOTE}</p>
    </div>
  );
}
