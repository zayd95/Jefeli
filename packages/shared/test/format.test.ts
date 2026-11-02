import { describe, expect, it } from 'vitest';
import {
  formatXOF, parseXOF, formatAmountInput, timeAgo, formatCount, initials, normalizeHandle, HANDLE_PATTERN,
  formatClock, toFrenchError, describeCashDifference, signedDifferenceLabel, canRespond, canWithdraw,
  shareUrls, publicStorageUrl, timeLeft,
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
