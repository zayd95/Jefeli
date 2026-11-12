/**
 * Explorer (white commerce page) with the DEMO seed (`pnpm seed`):
 *   - EX-01: the « Filtres » sheet sorts by price (cheapest first) and filters by a price range,
 *     on real listings returned by explore_products;
 *   - EX-02: « Vendeurs à suivre » shows real sellers with their article count.
 * Read-only: nothing is followed or saved, so the seed is unchanged.
 */
import { expect, test, type Page } from '@playwright/test';

import { DEVICES, newDevice, shot, signIn } from './helpers';

const PASSWORD = 'Demo-jefeli-2026!';

/** Card prices in page order (article cards are buttons named « title, price »); null without a shown price. */
async function cardPrices(page: Page): Promise<(number | null)[]> {
  const labels = await page
    .getByRole('button', { name: /, ([\d\s]+F\sCFA|Prix sur demande|À discuter|Wecci.*)$/ })
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return labels.map((l) => {
    const m = l.match(/, ([\d\s]+)F\sCFA/);
    return m ? Number(m[1].replace(/\D/g, '')) : null;
  });
}

async function openFilters(page: Page) {
  await page.getByRole('button', { name: /^Filtres/ }).first().click();
  await expect(page.getByRole('radiogroup', { name: 'Prix' })).toBeVisible();
}

test('EX-01 · Filtres: sort by price and a price range', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signIn(page, 'fatou@demo.jefeli.test', PASSWORD);
  await page.goto('/explore');
  await expect(page.getByTestId('listing-card').first()).toBeVisible();

  await openFilters(page);
  await page.getByRole('radio', { name: 'Prix : du moins cher' }).click();
  await expect(page.getByRole('radio', { name: 'Prix : du moins cher' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'explore', 'ex-01-filtres');
  await page.getByRole('button', { name: 'Voir les articles' }).click();
  await expect(page.getByRole('button', { name: 'Filtres, 1 actif' })).toBeVisible();
  await page.waitForTimeout(1500);
  const asc = (await cardPrices(page)).filter((p): p is number => p !== null);
  expect(asc.length).toBeGreaterThan(1);
  expect([...asc].sort((a, b) => a - b)).toEqual(asc);

  await openFilters(page);
  await page.getByRole('radio', { name: '5 000 à 20 000 F CFA' }).click();
  await page.getByRole('button', { name: 'Voir les articles' }).click();
  await expect(page.getByRole('button', { name: 'Filtres, 2 actifs' })).toBeVisible();
  await page.waitForTimeout(1500);
  const ranged = await cardPrices(page);
  expect(ranged.length).toBeGreaterThan(0);
  for (const p of ranged) {
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThanOrEqual(5000);
    expect(p!).toBeLessThanOrEqual(20000);
  }
  await shot(page, 'explore', 'ex-01-results');

  await openFilters(page);
  await page.getByRole('button', { name: 'Effacer' }).last().click();
  await page.getByRole('button', { name: 'Voir les articles' }).click();
  await expect(page.getByRole('button', { name: 'Filtres : prix, achat ou Wecci, tri' })).toBeVisible();
  await ctx.close();
});

test('EX-02 · Vendeurs à suivre: real sellers with their article count', async ({ browser }) => {
  const { ctx, page } = await newDevice(browser, DEVICES.iphone15ProMax);
  await signIn(page, 'fatou@demo.jefeli.test', PASSWORD);
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Vendeurs à suivre' })).toBeVisible();
  await expect(page.getByText(/\d+ articles?$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Suivre/ }).first()).toBeVisible();
  await ctx.close();
});
