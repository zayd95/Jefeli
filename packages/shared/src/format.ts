/**
 * Formatting helpers — French (Senegal) conventions.
 * XOF has no minor unit: amounts are integers of francs CFA.
 */

const NNBSP = '\u00A0'; // regular no-break space (U+202F renders cramped in Inter)

/** 25000 -> "25 000 F CFA" (compact: "25 000 F"). Never uses decimals. */
export function formatXOF(amount: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '';
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${sign}${digits}${NNBSP}${opts.compact ? 'F' : 'F CFA'}`;
}

/** Parse user input such as "25 000", "25.000", "25000 F" into an integer, or null. */
export function parseXOF(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  if (!Number.isFinite(value) || value > 100_000_000) return null;
  return value;
}

/** Format digits while typing: "25000" -> "25 000". */
export function formatAmountInput(input: string): string {
  const value = parseXOF(input);
  if (value === null) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const DAKAR_TZ = 'Africa/Dakar';

/** "à l'instant", "il y a 12 min", "il y a 3 h", "hier", "il y a 4 j", "12 mars". */
export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const diffSec = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 45) return "à l'instant";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  return formatDate(date, now);
}

export function formatDate(date: Date, now: Date = new Date()): string {
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  try {
    return new Intl.DateTimeFormat('fr-SN', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: DAKAR_TZ,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Clock time in Dakar (UTC+0, no DST) for message bubbles: "14:05". */
export function formatClock(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "1 abonné", "236 abonnés", "1,2 k abonnés". Real counts only. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toString().replace('.', ',')} k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)} k`;
  return `${(Math.floor(n / 100_000) / 10).toString().replace('.', ',')} M`;
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return n <= 1 ? singular : pluralForm;
}

/** Remaining time for a 24h status: "23 h", "45 min". */
export function timeLeft(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return 'expiré';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Initials for avatar fallbacks: "Awa Ndiaye" -> "AN". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || 'J';
}

/** Normalize a free-text handle candidate to the allowed ASCII form. */
export function normalizeHandle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/^[._]+/, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 30);
}

export const HANDLE_PATTERN = /^(?![._])(?!.*\.\.)(?!.*\.$)[a-z0-9_.]{3,30}$/;
