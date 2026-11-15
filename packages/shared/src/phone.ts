/**
 * Phone numbers for sign-up / sign-in by SMS code.
 *
 * Countries are listed here only once SMS delivery to them has been verified with real SIM
 * cards (docs/PHONE_AUTH.md). The server keeps its own allow-list (`private.sms_settings`), so
 * adding a country here alone never sends an SMS there.
 */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  flag: string;
  dial: string;
  /** National significant number length. */
  length: number;
  /** National mobile ranges that can receive an SMS. */
  mobile: RegExp;
  /** Fixed-line ranges: recognised so the member gets a precise message. */
  landline?: RegExp;
  example: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    dial: '221',
    length: 9,
    // Orange 77/78, Free/Yas 76, Expresso 70, Promobile 75.
    mobile: /^7[05678]\d{7}$/,
    landline: /^3[03]\d{7}$/,
    example: '77 123 45 67',
  },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]!;

export type PhoneParse =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: 'empty' | 'incomplete' | 'too_long' | 'landline' | 'not_mobile' | 'other_country' };

/** Digits the member typed, without the country prefix (accepts +221, 00221, 221…, spaces, dots). */
export function nationalDigits(input: string, country: PhoneCountry = DEFAULT_PHONE_COUNTRY): string {
  let digits = input.replace(/\D/g, '');
  const intl = input.trim().startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if ((intl || digits.length > country.length) && digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
  return digits;
}

export function parsePhone(input: string, country: PhoneCountry = DEFAULT_PHONE_COUNTRY): PhoneParse {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const digitsOnly = raw.replace(/\D/g, '');
  const intl = raw.startsWith('+') || digitsOnly.startsWith('00');
  const withoutZeros = digitsOnly.startsWith('00') ? digitsOnly.slice(2) : digitsOnly;
  if (intl && !withoutZeros.startsWith(country.dial)) return { ok: false, reason: 'other_country' };
  const national = nationalDigits(raw, country);
  if (national.length < country.length) return { ok: false, reason: 'incomplete' };
  if (national.length > country.length) return { ok: false, reason: 'too_long' };
  if (country.landline?.test(national)) return { ok: false, reason: 'landline' };
  if (!country.mobile.test(national)) return { ok: false, reason: 'not_mobile' };
  return { ok: true, e164: `+${country.dial}${national}`, national };
}

/** French explanation for a number that cannot receive a code (null while still typing). */
export function phoneProblem(parsed: PhoneParse, country: PhoneCountry = DEFAULT_PHONE_COUNTRY): string | null {
  if (parsed.ok) return null;
  switch (parsed.reason) {
    case 'empty':
    case 'incomplete':
      return null;
    case 'too_long':
      return `Trop de chiffres : un numéro (+${country.dial}) en compte ${country.length}, par exemple ${country.example}.`;
    case 'landline':
      return 'Ce numéro est un fixe : il ne peut pas recevoir de SMS. Saisissez un numéro de mobile.';
    case 'not_mobile':
      return `Ce numéro ne correspond pas à un mobile (+${country.dial}). Exemple : ${country.example}.`;
    case 'other_country':
      return `Pour l’instant, seuls les numéros du ${country.name} (+${country.dial}) peuvent recevoir un code.`;
  }
}

/** « +221 77 123 45 67 » for display (never shown publicly: numbers stay private). */
export function formatPhone(e164OrDigits: string): string {
  const digits = e164OrDigits.replace(/\D/g, '');
  const country = PHONE_COUNTRIES.find((c) => digits.startsWith(c.dial) && digits.length === c.dial.length + c.length);
  if (!country) return e164OrDigits.startsWith('+') ? e164OrDigits : `+${digits}`;
  const n = digits.slice(country.dial.length);
  return `+${country.dial} ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/** Seconds to wait from « …you can only request this after 36 seconds. », else null. */
export function retryAfterSeconds(err: unknown): number | null {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  const m = msg.match(/after (\d+) seconds?/i);
  return m ? Number(m[1]) : null;
}
