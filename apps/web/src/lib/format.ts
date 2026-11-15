import { formatXOF } from '@jefeli/shared';

/**
 * Display price. Same rules as the shared formatXOF, but with regular no-break spaces: the
 * narrow no-break space renders too tight in Inter ("35 000F") at UI sizes.
 */
export function xof(amount: number | null | undefined, opts: { compact?: boolean } = {}): string {
  return formatXOF(amount, opts).replace(/ /g, ' ');
}

/** French elision for "de" before a name: "d’Awa", "de Moussa". */
export function deName(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûüh]/i.test(name.trim()) ? `d’${name}` : `de ${name}`;
}
