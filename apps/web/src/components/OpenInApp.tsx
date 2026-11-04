import { IconExternal } from './icons';

/** Honest pilot explanation shown under every « open in the app » button by default. */
export const OPEN_IN_APP_NOTE =
  'Le bouton ouvre l’application Jëfëli si elle est installée sur ce téléphone. L’application est en phase pilote : si rien ne se passe, elle n’est pas encore installée.';

/**
 * Deep link into the native app (jefeli://…). There is no store listing yet (pilot), so the
 * fallback is an honest explanation rather than a fake download link.
 */
export function OpenInApp({ href, label, note }: { href: string; label: string; note?: string }) {
  return (
    <div>
      <a className="btn btn-primary btn-block" href={href}>
        {label}
        <IconExternal width={18} height={18} />
      </a>
      <p className="cta-note">{note ?? OPEN_IN_APP_NOTE}</p>
    </div>
  );
}
