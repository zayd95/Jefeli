import { describe, expect, it } from 'vitest';
import { describeFailure } from '../src/errors';
import {
  formatXOF, parseXOF, formatAmountInput, timeAgo, formatCount, initials, normalizeHandle, HANDLE_PATTERN,
  formatClock, toFrenchError, describeCashDifference, signedDifferenceLabel, canRespond, canWithdraw,
  shareUrls,
  formatMemberSince, publicStorageUrl, timeLeft, formatListingPrice, hasDisplayedPrice,
  suggestHandle, toSenegalE164,
} from '../src';

const NN = '\u00A0';

describe('XOF formatting', () => {
  it('formats integers with narrow no-break spaces and F CFA', () => {
    expect(formatXOF(25000)).toBe(`25${NN}000${NN}F CFA`);
    expect(formatXOF(1500000, { compact: true })).toBe(`1${NN}500${NN}000${NN}F`);
    expect(formatXOF(0)).toBe(`0${NN}F CFA`);
    expect(formatXOF(null)).toBe('');
  });
  it('never shows decimals', () => {
    expect(formatXOF(999.6)).toBe(`1${NN}000${NN}F CFA`);
  });
  it('parses user input', () => {
    expect(parseXOF('25 000 F')).toBe(25000);
    expect(parseXOF('25.000')).toBe(25000);
    expect(parseXOF('abc')).toBeNull();
    expect(parseXOF('999999999999')).toBeNull();
    expect(formatAmountInput('35000')).toBe('35 000');
  });
});

describe('dates & counts', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  it('relative time in French', () => {
    expect(timeAgo('2026-11-02T11:59:50Z', now)).toBe("à l'instant");
    expect(timeAgo('2026-11-02T11:48:00Z', now)).toBe('il y a 12 min');
    expect(timeAgo('2026-11-02T09:00:00Z', now)).toBe('il y a 3 h');
    expect(timeAgo('2026-11-01T10:00:00Z', now)).toBe('hier');
    expect(timeAgo('2026-10-29T10:00:00Z', now)).toBe('il y a 4 j');
  });
  it('Dakar clock (UTC+0)', () => {
    expect(formatClock('2026-11-02T14:05:00Z')).toBe('14:05');
  });
  it('status time left', () => {
    expect(timeLeft('2026-11-02T12:45:00Z', now)).toBe('45 min');
    expect(timeLeft('2026-11-03T11:00:00Z', now)).toBe('23 h');
    expect(timeLeft('2026-11-02T11:00:00Z', now)).toBe('expiré');
  });
  it('counts', () => {
    expect(formatCount(236)).toBe('236');
    expect(formatCount(1234)).toBe('1,2 k');
    expect(formatCount(45000)).toBe('45 k');
  });
});

describe('identity helpers', () => {
  it('initials', () => {
    expect(initials('Awa Ndiaye')).toBe('AN');
    expect(initials('Mamadou')).toBe('M');
  });
  it('handles keep ë-free ASCII form', () => {
    expect(normalizeHandle('Awa Boutique Thiès')).toBe('awa_boutique_thies');
    expect(normalizeHandle('..jëfëli..shop')).toBe('jefeli.shop');
    expect(HANDLE_PATTERN.test('awa_boutique')).toBe(true);
    expect(HANDLE_PATTERN.test('ab')).toBe(false);
    expect(HANDLE_PATTERN.test('.awa')).toBe(false);
    expect(HANDLE_PATTERN.test('awa.')).toBe(false);
  });
});

describe('errors', () => {
  it('maps database keys to French', () => {
    expect(toFrenchError({ message: 'rate_limited' })).toMatch(/un peu vite/);
    expect(toFrenchError({ message: 'prohibited_item' })).toMatch(/interdits/);
    expect(toFrenchError({ message: 'Invalid login credentials' })).toMatch(/incorrect/);
    expect(toFrenchError({ message: 'something odd' })).toMatch(/erreur/);
  });
  it('maps the video limits enforced by the database (W1.1)', () => {
    expect(toFrenchError({ message: 'video_too_long' })).toBe('Vidéo trop longue : 3 minutes maximum.');
    expect(toFrenchError({ message: 'video_duration_required' })).toMatch(/Durée de la vidéo illisible/);
    expect(toFrenchError({ message: 'invalid_media' })).not.toBe('Une erreur est survenue. Réessayez.');
  });
  it('maps the voice and shared-status rules (W1.2)', () => {
    expect(toFrenchError({ message: 'audio_too_long' })).toBe('Enregistrement trop long : 3 minutes maximum.');
    expect(toFrenchError({ message: 'audio_with_video' })).toMatch(/vidéo garde son propre son/);
    for (const key of ['too_many_audio', 'invalid_cues', 'invalid_reference', 'audience_wider_than_post', 'caption_too_long']) {
      expect(toFrenchError({ message: key })).not.toBe('Une erreur est survenue. Réessayez.');
    }
  });
});

describe('describeFailure (W1.3: no dead homepage)', () => {
  it('a database behind the app is an update in progress, not retried in a loop, with its code', () => {
    const f = describeFailure({ code: '42703', message: 'column post_media_1.language does not exist' });
    expect(f).toMatchObject({ kind: 'outdated', title: 'Mise à jour en cours', code: '42703', retryable: false });
    expect(describeFailure({ code: 'PGRST202', message: 'Could not find the function' }).kind).toBe('outdated');
  });
  it('network, server and session failures say what to do', () => {
    expect(describeFailure(new TypeError('Failed to fetch'))).toMatchObject({ kind: 'network', retryable: true });
    expect(describeFailure({ code: 'PGRST002', message: 'Could not query the database for the schema cache' })).toMatchObject({ kind: 'service', retryable: true });
    expect(describeFailure({ message: 'JWT expired', code: 'PGRST303' })).toMatchObject({ kind: 'session', retryable: false });
  });
  it('anything else keeps the French message and a reference', () => {
    expect(describeFailure({ message: 'rate_limited' })).toMatchObject({ kind: 'other', code: 'rate_limited' });
  });
});

describe('offers', () => {
  it('describes the cash difference from each side', () => {
    expect(describeCashDifference(15000, 'buyer', true)).toBe(`Vous ajoutez 15${NN}000${NN}F CFA`);
    expect(describeCashDifference(15000, 'buyer', false)).toBe(`Vous recevez 15${NN}000${NN}F CFA`);
    expect(describeCashDifference(0, null, true)).toBe('Échange sans différence');
    expect(signedDifferenceLabel(15000, 'buyer')).toBe(`Différence : +15${NN}000${NN}F CFA`);
  });
  it('permissions mirror server rules', () => {
    const offer = { status: 'pending', recipient_id: 'b', proposer_id: 'a', expires_at: '2999-01-01T00:00:00Z' };
    expect(canRespond(offer, 'b')).toBe(true);
    expect(canRespond(offer, 'a')).toBe(false);
    expect(canWithdraw(offer, 'a')).toBe(true);
    expect(canRespond({ ...offer, expires_at: '2000-01-01T00:00:00Z' }, 'b')).toBe(false);
  });
});

describe('links', () => {
  it('builds share URLs', () => {
    expect(shareUrls.profile('https://jefeli.example/', 'awa')).toBe('https://jefeli.example/awa');
    expect(shareUrls.product('https://jefeli.example', 'x1')).toBe('https://jefeli.example/p/x1');
    expect(publicStorageUrl('http://127.0.0.1:54321', 'avatars', 'u1/a b.jpg')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/avatars/u1/a%20b.jpg',
    );
  });
});

describe('formatListingPrice (flexible pricing)', () => {
  const N = ' ';
  it('shows a fixed price', () => {
    expect(formatListingPrice({ price_xof: 28000, price_mode: 'fixed', listing_mode: 'sale' })).toBe(`28${N}000${N}F CFA`);
    expect(formatListingPrice({ price_xof: 28000, price_mode: 'fixed' }, { compact: true })).toBe(`28${N}000${N}F`);
  });
  it('never shows 0 F or an invented price', () => {
    expect(formatListingPrice({ price_xof: 0, price_mode: 'fixed', listing_mode: 'sale' })).toBe('Prix sur demande');
    expect(formatListingPrice({ price_xof: null, price_mode: 'fixed', listing_mode: 'trade' })).toBe('À échanger');
    expect(formatListingPrice({ price_xof: null, price_mode: null, listing_mode: 'sale' })).toBe('Prix sur demande');
  });
  it('« Prix sur demande » hides any amount', () => {
    expect(formatListingPrice({ price_xof: 15000, price_mode: 'on_request' })).toBe('Prix sur demande');
    expect(hasDisplayedPrice({ price_xof: 15000, price_mode: 'on_request' })).toBe(false);
  });
  it('« À discuter » with or without a starting price', () => {
    expect(formatListingPrice({ price_xof: 25000, price_mode: 'negotiable' })).toBe(`25${N}000${N}F CFA · à discuter`);
    expect(formatListingPrice({ price_xof: null, price_mode: 'negotiable' })).toBe('Prix à discuter');
  });
});

describe('formatMemberSince', () => {
  it('uses French month names in Dakar time (UTC)', () => {
    expect(formatMemberSince('2026-03-14T10:00:00Z')).toBe('Membre depuis mars 2026');
    expect(formatMemberSince('2025-12-31T23:59:00Z')).toBe('Membre depuis décembre 2025');
  });
  it('returns an empty string for an invalid date', () => {
    expect(formatMemberSince('not a date')).toBe('');
  });
});

describe('toFrenchError — boutique identity checks', () => {
  it('maps the merchant identity and name length constraints to precise French copy', () => {
    expect(toFrenchError({ message: 'new row for relation "profiles" violates check constraint "profiles_boutique_identity_required"' })).toBe(
      'Pour être affiché comme vendeur, indiquez le nom et la catégorie de votre boutique.',
    );
    expect(toFrenchError({ message: 'new row for relation "profiles" violates check constraint "profiles_boutique_name_length"' })).toBe(
      'Le nom de la boutique doit compter entre 2 et 60 caractères.',
    );
    // A double tap on « Envoyer la proposition » (reproduced in integration 15): not « invalid form ».
    expect(toFrenchError({ code: '23505', message: 'duplicate key value violates unique constraint "offers_one_pending_per_pair"' })).toBe(
      'Vous avez déjà une proposition en attente pour cet article.',
    );
    // « Nouveau mot de passe » after a recovery link, when the member re-types the old one.
    expect(toFrenchError({ code: 'same_password', message: 'New password should be different from the old password.' })).toBe(
      'Choisissez un mot de passe différent de l’ancien.',
    );
    // « Donner mon avis » (W1): an empty or too long message.
    expect(toFrenchError({ code: '23514', message: 'new row for relation "feedback" violates check constraint "feedback_message_length"' })).toBe(
      'Écrivez entre 3 et 1 000 caractères.',
    );
  });
});

describe('one-screen onboarding helpers', () => {
  it('suggests a valid, editable handle from the display name', () => {
    expect(suggestHandle('Awa Ndiaye')).toBe('awa.ndiaye');
    expect(suggestHandle('  Aïssatou   Diop ')).toBe('aissatou.diop');
    expect(suggestHandle('Awa ')).toBe('awa');
    expect(HANDLE_PATTERN.test(suggestHandle('Mamadou Lamine Ndiaye-Sarr'))).toBe(true);
    expect(suggestHandle('x'.repeat(40)).length).toBe(30);
  });
});

describe('Senegal-only SMS numbers (+221)', () => {
  it('accepts Senegalese mobile and fixed numbers in common spellings', () => {
    expect(toSenegalE164('77 123 45 67')).toBe('+221771234567');
    expect(toSenegalE164('+221 76 000 11 22')).toBe('+221760001122');
    expect(toSenegalE164('00221 70 999 88 77')).toBe('+221709998877');
    expect(toSenegalE164('221781234567')).toBe('+221781234567');
    expect(toSenegalE164('33 821 00 00')).toBe('+221338210000');
  });
  it('refuses numbers outside Senegal or malformed ones', () => {
    expect(toSenegalE164('+33 6 12 34 56 78')).toBeNull();
    expect(toSenegalE164('+1 415 555 0100')).toBeNull();
    expect(toSenegalE164('77 123 45')).toBeNull();
    expect(toSenegalE164('79 123 45 67')).toBeNull();
    expect(toSenegalE164('')).toBeNull();
  });
});
