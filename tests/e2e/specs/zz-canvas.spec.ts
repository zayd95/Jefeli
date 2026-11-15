/**
 * Canvas test (owner, P1 addendum 15 Nov) — not part of the regression suite (run with CANVAS=setup
 * or CANVAS=A|B|C). Renders Accueil, Explorer, two articles (beige dress, white phone) and the
 * Boutique at 390 px for one canvas variant.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { EVIDENCE, FIXTURE, newDevice, publishListing, signIn, signUp } from './helpers';

const MODE = process.env.CANVAS;
const STATE = '/tmp/claude-0/-home-user/e384a170-549f-5d17-8685-7f62aa5993e5/scratchpad/canvas-seller.json';
const OUT = path.join(EVIDENCE, '..', 'p1-identity', 'canvas-test', 'raw');
const W390 = { width: 390, height: 844 };

test.skip(!MODE, 'canvas test only on demand');

test('canvas setup: seller with a beige dress and a white phone', async ({ browser }) => {
  test.skip(MODE !== 'setup');
  test.setTimeout(240_000);
  const id = Math.random().toString(36).slice(2, 6);
  const S = { name: `Awa Couture ${id}`, email: `canvas-${id}@e2e.jefeli.test`, handle: `awa_couture_${id}`, password: 'Test-jefeli-2026!' };
  const { page } = await newDevice(browser, W390);
  await signUp(page, S);
  await publishListing(page, { file: FIXTURE('photo-white-phone.jpg'), title: 'iPhone 13 blanc 128 Go', mode: 'Vente', price: '185000', category: 'Téléphones & tablettes', condition: 'Très bon état' });
  const phone = page.url().match(/\/p\/([0-9a-f-]{36})/)![1];
  await publishListing(page, { file: FIXTURE('photo-beige-dress.jpg'), title: 'Robe longue beige en lin', mode: 'Vente ou troc', price: '25000', category: 'Mode femme', condition: 'Comme neuf' });
  const dress = page.url().match(/\/p\/([0-9a-f-]{36})/)![1];
  fs.writeFileSync(STATE, JSON.stringify({ ...S, phone, dress }));
});

test('canvas capture', async ({ browser }) => {
  test.skip(MODE === 'setup');
  test.setTimeout(240_000);
  const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const { page } = await newDevice(browser, W390);
  await signIn(page, 'fatou@demo.jefeli.test', 'Demo-jefeli-2026!');
  const snap = async (name: string) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${name}-${MODE}.png`) });
  };
  await page.goto('/');
  await expect(page.getByText('Robe longue beige en lin').first()).toBeVisible({ timeout: 30_000 });
  await page.getByText('Robe longue beige en lin').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  await snap('1-accueil');
  await page.goto('/explore');
  await expect(page.getByTestId('listing-card').first()).toBeVisible();
  await page.getByTestId('listing-card').first().scrollIntoViewIfNeeded();
  await snap('2-explorer');
  await page.goto(`/p/${s.dress}`);
  await expect(page.getByText('Robe longue beige en lin').first()).toBeVisible();
  await snap('3-article-robe-beige');
  await page.goto(`/p/${s.phone}`);
  await expect(page.getByText('iPhone 13 blanc 128 Go').first()).toBeVisible();
  await snap('4-article-telephone-blanc');
  await page.goto(`/u/${s.handle}`);
  await page.getByRole('tab', { name: /^Boutique/ }).click();
  await expect(page.getByText('Robe longue beige en lin').first()).toBeVisible();
  await snap('5-boutique');
});
